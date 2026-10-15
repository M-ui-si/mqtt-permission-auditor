#!/usr/bin/env node
// Local developer entrypoint. Not exposed as an AGH tool.
import { existsSync, lstatSync, mkdirSync, readFileSync, writeFileSync, copyFileSync, realpathSync } from 'node:fs'
import { randomBytes } from 'node:crypto'
import { spawnSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { probePublish } from '../core/prober.mjs'
import { runAudit } from '../core/runner.mjs'
import { renderHuman } from '../core/report.mjs'

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
export const IMAGES = {
  source: 'eclipse-mosquitto@sha256:38c0da4f2ef84284d47b3b3eeea1cb3bdeabe81ee10caf0cd5c5ff61ee3ea408',
  target: 'emqx@sha256:5ecbf93d04e34aaf4096af074e93b773d0838c8ea668cfabdec7976b272d9606',
}
const IDENTITIES = ['auditor', 'device-sensor', 'ops-admin', 'guest-ro', 'no-rules-user']
const VARIANTS = ['naive', 'corrected', 'omission']
const SCHEMA = 'mqtt-audit-environment/1'
const BROKERS = {
  source: { host: '127.0.0.1', port: 11883, label: 'source-mosquitto' },
  target: { host: '127.0.0.1', port: 2883, label: 'target-emqx' },
}

export function environmentPath(root, name = 'env') {
  if (!/^[a-z][a-z0-9-]{0,31}$/.test(name)) throw new Error('环境名仅允许小写字母、数字、连字符，最长 32 字符。')
  const base = path.resolve(root)
  const target = path.join(base, '.local', name)
  // Check every existing ancestor, including junctions, before any write or Docker mount.
  let current = path.parse(target).root
  for (const part of target.slice(current.length).split(path.sep)) {
    current = path.join(current, part)
    if (existsSync(current) && lstatSync(current).isSymbolicLink()) throw new Error('环境路径含重解析点，停止操作。')
  }
  return target
}

function writeNew(file, data) {
  writeFileSync(file, data, { encoding: 'utf8', flag: 'wx', mode: 0o600 })
}

export function composeTemplate(project) {
  const service = (image, port, network, mounts, memory) => ({
    image, ports: [`127.0.0.1:${port}:1883`], networks: [network],
    volumes: mounts, mem_limit: memory,
    logging: { driver: 'json-file', options: { 'max-size': '10m', 'max-file': '3' } },
  })
  // JSON is also a valid Compose document; avoids a YAML parser dependency.
  return {
    name: project,
    services: {
      mosquitto: service(IMAGES.source, 11883, 'source', [
        './mosquitto/config:/mosquitto/config:ro', './mosquitto/dynamic:/mosquitto/dynamic:ro',
        'mosquitto-data:/mosquitto/data',
      ], '256m'),
      emqx: service(IMAGES.target, 2883, 'target', [
        './emqx/emqx.conf:/opt/emqx/etc/emqx.conf:ro', './emqx/acl.conf:/opt/emqx/etc/acl.conf:ro',
        './emqx/auth.csv:/opt/emqx/etc/auth-built-in-db-bootstrap.csv:ro',
        'emqx-data:/opt/emqx/data', 'emqx-log:/opt/emqx/log',
      ], '1g'),
    },
    // Docker's `internal` networks are intentionally disconnected from host interfaces, so
    // published ports silently remain unusable on Docker Desktop. Keep the brokers on separate
    // user-defined bridges, bind only loopback ports, and disable outbound IP masquerading.
    networks: {
      source: { driver: 'bridge', driver_opts: { 'com.docker.network.bridge.enable_ip_masquerade': 'false' } },
      target: { driver: 'bridge', driver_opts: { 'com.docker.network.bridge.enable_ip_masquerade': 'false' } },
    },
    volumes: { 'mosquitto-data': {}, 'emqx-data': {}, 'emqx-log': {} },
  }
}

export function initEnvironment({ root = ROOT, name = 'env', variant = 'naive' } = {}) {
  if (!VARIANTS.includes(variant)) throw new Error(`ACL 档案必须为 ${VARIANTS.join(' / ')}`)
  const dir = environmentPath(root, name)
  if (existsSync(dir)) throw new Error(`环境目录已存在，拒绝覆盖。请用 --name 指定新名称：${dir}`)
  mkdirSync(path.dirname(dir), { recursive: true })
  mkdirSync(dir) // exclusive creation: a racing initializer cannot replace credentials
  for (const child of ['mosquitto/config', 'mosquitto/dynamic', 'emqx', 'agh-runs']) mkdirSync(path.join(dir, child), { recursive: true })
  const creds = Object.fromEntries(IDENTITIES.map((id) => [id, randomBytes(24).toString('hex')]))
  writeNew(path.join(dir, 'creds.json'), JSON.stringify(creds, null, 2))
  writeNew(path.join(dir, 'mosquitto/dynamic/passwd'), Object.entries(creds).map(([id, pw]) => `${id}:${pw}`).join('\n') + '\n')
  writeNew(path.join(dir, 'emqx/auth.csv'), 'user_id,password,is_superuser\n' + Object.entries(creds).map(([id, pw]) => `${id},${pw},false`).join('\n') + '\n')
  writeNew(path.join(dir, 'emqx/emqx.conf'), `node {
  name = "emqx@127.0.0.1"
  cookie = "${randomBytes(24).toString('hex')}"
  data_dir = "data"
}
cluster { discovery_strategy = manual }
authentication = [{
  enable = true
  mechanism = password_based
  backend = built_in_database
  user_id_type = username
  password_hash_algorithm { name = sha256, salt_position = suffix }
  bootstrap_file = "/opt/emqx/etc/auth-built-in-db-bootstrap.csv"
  bootstrap_type = plain
}]
authorization {
  no_match = deny
  deny_action = ignore
  sources = [{ type = file, enable = true, path = "/opt/emqx/etc/acl.conf" }]
}
`)
  for (const [source, dest] of [['mosquitto.conf', 'mosquitto/config/mosquitto.conf'], ['source.acl', 'mosquitto/config/acl'], [`${variant}.acl`, 'emqx/acl.conf']]) {
    copyFileSync(path.join(ROOT, 'deploy', source), path.join(dir, dest))
  }
  const project = `mqtt-audit-${name}`
  writeNew(path.join(dir, 'compose.json'), JSON.stringify(composeTemplate(project), null, 2))
  writeNew(path.join(dir, 'environment.json'), JSON.stringify({ schema: SCHEMA, project, variant, hashed: false }, null, 2))
  return { dir, project, variant }
}

function docker(args, { cwd, capture = false } = {}) {
  const result = spawnSync('docker', args, { cwd, encoding: 'utf8', shell: false, timeout: 180000,
    stdio: capture ? ['ignore', 'pipe', 'pipe'] : ['ignore', 'inherit', 'inherit'] })
  if (result.error || result.status !== 0) throw new Error('Docker 命令失败；请确认 Docker Desktop 已运行、镜像可用，并检查上方错误。')
  return result.stdout?.trim() ?? ''
}

function managedEnvironment(name) {
  const dir = environmentPath(ROOT, name)
  const manifest = path.join(dir, 'environment.json')
  if (!existsSync(manifest)) throw new Error('不是本脚本生成的环境；不会接管旧 .local/env。请先 init --name 新名称。')
  // Refuse symlinked runtime files/subdirectories before Docker mounts or credential reads.
  for (const relative of ['environment.json', 'compose.json', 'creds.json', 'mosquitto', 'mosquitto/config', 'mosquitto/dynamic', 'mosquitto/dynamic/passwd', 'mosquitto/config/acl', 'mosquitto/config/mosquitto.conf', 'emqx', 'emqx/emqx.conf', 'emqx/acl.conf', 'emqx/auth.csv', 'agh-runs']) {
    const file = path.join(dir, relative)
    if (lstatSync(file).isSymbolicLink() || !realpathSync(file).startsWith(realpathSync(dir) + path.sep)) throw new Error('环境包含外部路径或重解析点，停止操作。')
  }
  const info = JSON.parse(readFileSync(manifest, 'utf8'))
  if (info.schema !== SCHEMA || info.project !== `mqtt-audit-${name}` || !VARIANTS.includes(info.variant)) throw new Error('环境标记无效。')
  if (JSON.stringify(JSON.parse(readFileSync(path.join(dir, 'compose.json'), 'utf8'))) !== JSON.stringify(composeTemplate(info.project))) throw new Error('Compose 与受控模板不一致，停止操作。')
  return { dir, info, manifest }
}

export async function checkBrokers(creds, probe = probePublish) {
  const checks = await Promise.all(Object.entries(BROKERS).map(async ([side, broker]) => {
    const result = await probe({ broker, identity: 'device-sensor', password: creds['device-sensor'],
      witness: 'auditor', witnessPassword: creds.auditor, topic: 'telemetry/setup-health',
      tag: `setup-${randomBytes(12).toString('hex')}`, timeouts: { connect: 2000, ack: 2000, delivery: 2000 } })
    return [side, { ready: result.observed === 'allow', reason: result.reason }]
  }))
  return Object.fromEntries(checks)
}

const usage = '用法：node cli/environment.mjs init|up|check|audit|down [--name env] [--variant naive|corrected|omission（仅 init）]\ninit 拒绝覆盖已有目录；down 保留数据卷与文件；不启动 AGH 或读取模型凭据。'

export async function main(argv = process.argv.slice(2)) {
  const [major, minor] = process.versions.node.split('.').map(Number)
  if (major < 24 || (major === 24 && minor < 10)) throw new Error('需要 Node.js 24.10 或更高版本。请使用仓库保留的 .tools/node24/node.exe。')
  const [command, ...args] = argv
  if (!command || command === '--help') { console.log(usage); return 0 }
  if (!['init', 'up', 'check', 'audit', 'down'].includes(command)) throw new Error(usage)
  let name = 'env', variant = 'naive'
  const seen = new Set()
  for (let i = 0; i < args.length; i += 2) {
    const key = args[i], value = args[i + 1]
    if (!['--name', '--variant'].includes(key) || !value || value.startsWith('--') || seen.has(key)) throw new Error(usage)
    seen.add(key)
    if (key === '--name') name = value
    else variant = value
  }
  if (command !== 'init' && seen.has('--variant')) throw new Error('--variant 仅用于创建新环境；不在现有实例上静默切换 ACL。')
  environmentPath(ROOT, name)
  if (command === 'init') {
    const result = initEnvironment({ name, variant })
    console.log(`环境已生成：${result.dir}\nACL 档案：${variant}\n下一步：node cli/environment.mjs up --name ${name}`)
    return 0
  }
  const { dir, info, manifest } = managedEnvironment(name)
  const compose = (...extra) => docker(['compose', '-p', info.project, '-f', path.join(dir, 'compose.json'), ...extra], { cwd: dir })
  if (command === 'down') { compose('down'); return 0 }
  if (command === 'up') {
    docker(['info', '--format', '{{.ServerVersion}}'], { capture: true })
    const preparePasswdForHash = () => docker(['run', '--rm', '--network', 'none', '--mount', `type=bind,source=${dir},target=/generated`, '--entrypoint', 'sh', IMAGES.source,
      '-c', 'chown root:root /generated/mosquitto/dynamic/passwd && chmod 600 /generated/mosquitto/dynamic/passwd'])
    // Windows bind mounts may appear world-readable in the Linux VM despite Node's mode: 0600.
    // mosquitto_passwd expects its input owned by root; before the broker starts, ownership moves
    // to the runtime user (1883) in the final normalization below.
    preparePasswdForHash()
    if (!info.hashed) {
      // Recover safely if a previous hash command completed but manifest persistence failed.
      const passwd = readFileSync(path.join(dir, 'mosquitto/dynamic/passwd'), 'utf8')
      if (!passwd.trim().split('\n').every((line) => /^[-a-z]+:\$7\$/.test(line))) {
        docker(['run', '--rm', '--network', 'none', '--mount', `type=bind,source=${path.join(dir, 'mosquitto/dynamic')},target=/generated`,
          '--entrypoint', 'mosquitto_passwd', IMAGES.source, '-U', '/generated/passwd'])
      }
      info.hashed = true
      writeFileSync(manifest, JSON.stringify(info, null, 2), 'utf8')
    }
    // Re-apply the private mode in case the hash utility replaced the file, and make only
    // non-secret broker configuration readable.
    docker(['run', '--rm', '--network', 'none', '--mount', `type=bind,source=${dir},target=/generated`, '--entrypoint', 'sh', IMAGES.source,
      '-c', 'chown 1883:1883 /generated/mosquitto/dynamic/passwd && chmod 600 /generated/mosquitto/dynamic/passwd && chmod 644 /generated/emqx/emqx.conf /generated/emqx/auth.csv'])
    compose('up', '-d', '--wait', '--wait-timeout', '90')
  }
  const creds = JSON.parse(readFileSync(path.join(dir, 'creds.json'), 'utf8'))
  if (command === 'audit') {
    const caseSet = JSON.parse(readFileSync(path.join(ROOT, 'fixtures/cases/migration-baseline.json'), 'utf8'))
    const result = await runAudit({ caseSet, brokers: BROKERS, creds, witness: 'auditor' })
    result.runId = `run-${Date.now()}-${randomBytes(4).toString('hex')}`
    result.instanceId = 'local-isolated'
    result.environmentVariant = info.variant
    writeNew(path.join(dir, 'agh-runs', `${result.runId}.json`), JSON.stringify(result, null, 2))
    console.log(renderHuman(result))
    return result.summary.overall === 'pass' ? 0 : result.summary.overall === 'fail' ? 1 : 2
  }
  const deadline = Date.now() + (command === 'up' ? 90000 : 0)
  let health
  do {
    health = await checkBrokers(creds)
    if (Object.values(health).every((item) => item.ready)) break
    if (Date.now() >= deadline) break
    await new Promise((resolve) => setTimeout(resolve, 2000))
  } while (Date.now() < deadline)
  for (const [side, state] of Object.entries(health)) console.log(`${side}: ${state.ready ? 'MQTT 送达检查通过' : '未就绪（无法判定）'} — ${state.reason}`)
  return Object.values(health).every((item) => item.ready) ? 0 : 2
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().then((code) => { process.exitCode = code }).catch((error) => { console.error(error.message); process.exitCode = 3 })
}
