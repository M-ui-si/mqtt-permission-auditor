import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, readFileSync, existsSync, rmSync, symlinkSync } from 'node:fs'
import path from 'node:path'
import { tmpdir } from 'node:os'
import { initEnvironment, environmentPath, checkBrokers, composeTemplate, IMAGES } from '../../cli/environment.mjs'

test('生成可移植双网配置、独立合成凭据并拒绝覆盖', () => {
  const root = mkdtempSync(path.join(tmpdir(), 'mqtt-setup-'))
  try {
    const { dir } = initEnvironment({ root })
    const before = readFileSync(path.join(dir, 'creds.json'), 'utf8')
    const creds = JSON.parse(before)
    assert.equal(Object.keys(creds).length, 5)
    assert.equal(new Set(Object.values(creds)).size, 5)
    assert.throws(() => initEnvironment({ root }), /拒绝覆盖/)
    assert.equal(readFileSync(path.join(dir, 'creds.json'), 'utf8'), before)
    const compose = JSON.parse(readFileSync(path.join(dir, 'compose.json'), 'utf8'))
    assert.deepEqual(compose, composeTemplate('mqtt-audit-env'))
    assert.equal(compose.services.mosquitto.image, IMAGES.source)
    assert.equal(compose.services.emqx.image, IMAGES.target)
    assert.deepEqual(compose.services.emqx.ports, ['127.0.0.1:2883:1883'])
    assert.deepEqual(compose.services.mosquitto.ports, ['127.0.0.1:11883:1883'])
    assert.deepEqual(compose.networks, {
      source: { driver: 'bridge', driver_opts: { 'com.docker.network.bridge.enable_ip_masquerade': 'false' } },
      target: { driver: 'bridge', driver_opts: { 'com.docker.network.bridge.enable_ip_masquerade': 'false' } },
    })
    assert.deepEqual(compose.services.mosquitto.networks, ['source'])
    assert.deepEqual(compose.services.emqx.networks, ['target'])
    assert.ok(compose.services.mosquitto.ports[0].startsWith('127.0.0.1:'))
    assert.ok(compose.services.emqx.ports[0].startsWith('127.0.0.1:'))
    assert.ok(!JSON.stringify(compose).includes(root))
    const second = initEnvironment({ root, name: 'second', variant: 'corrected' })
    assert.notEqual(readFileSync(path.join(second.dir, 'creds.json'), 'utf8'), before)
    const acl = readFileSync(path.join(second.dir, 'emqx/acl.conf'), 'utf8')
    assert.ok(acl.indexOf('{deny, {username, "device-sensor"}') < acl.indexOf('{allow, {username, "device-sensor"}'))
  } finally { rmSync(root, { recursive: true, force: true }) }
})

test('环境启动脚本分阶段设置 Mosquitto 密码文件的 0600 属主与权限', () => {
  const source = readFileSync(new URL('../../cli/environment.mjs', import.meta.url), 'utf8')
  assert.match(source, /chown root:root \/generated\/mosquitto\/dynamic\/passwd && chmod 600 \/generated\/mosquitto\/dynamic\/passwd/)
  assert.match(source, /chown 1883:1883 \/generated\/mosquitto\/dynamic\/passwd && chmod 600 \/generated\/mosquitto\/dynamic\/passwd/)
  assert.ok(source.indexOf('preparePasswdForHash()') < source.indexOf("if (!info.hashed)"))
})

test('目录穿越、无效档案在任何写入前拒绝', () => {
  const root = mkdtempSync(path.join(tmpdir(), 'mqtt-setup-'))
  try {
    for (const name of ['../outside', '..', 'C:\\outside', 'x/y', 'a b', '', 'a'.repeat(33)]) assert.throws(() => environmentPath(root, name))
    assert.throws(() => initEnvironment({ root, variant: '../x' }))
    assert.equal(existsSync(path.join(root, '.local')), false)
  } finally { rmSync(root, { recursive: true, force: true }) }
})

test('拒绝通过 junction 或 symlink 将环境写到目录外', () => {
  const root = mkdtempSync(path.join(tmpdir(), 'mqtt-setup-'))
  const outside = mkdtempSync(path.join(tmpdir(), 'mqtt-outside-'))
  try {
    mkdirSync(path.join(root, '.local'))
    symlinkSync(outside, path.join(root, '.local', 'linked'), 'junction')
    assert.throws(() => environmentPath(root, 'linked'), /重解析点/)
  } finally { rmSync(root, { recursive: true, force: true }); rmSync(outside, { recursive: true, force: true }) }
})

test('健康检查以送达为准，不把未知或拒绝算作就绪', async () => {
  for (const observed of ['unknown', 'deny', 'allow']) {
    const options = []
    const result = await checkBrokers({ auditor: 'synthetic', 'device-sensor': 'synthetic' }, async (args) => {
      options.push(args)
      return { observed, reason: 'test-observation' }
    })
    assert.deepEqual(Object.values(result).map((item) => item.ready), [observed === 'allow', observed === 'allow'])
    assert.ok(options.every((item) => item.broker.host === '127.0.0.1' && item.topic === 'telemetry/setup-health'))
    assert.notEqual(options[0].tag, options[1].tag)
  }
})
