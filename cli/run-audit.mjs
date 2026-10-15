#!/usr/bin/env node
// 独立 CLI 入口：对本地隔离 Broker 运行固定案例集，输出人读报告与机器可读 JSON。
// 用法：
//   node cli/run-audit.mjs --source 127.0.0.1:11883 --target 127.0.0.1:2883 \
//     --creds .local/env/creds.json --cases fixtures/cases/migration-baseline.json [--json out.json]
// 退出码：0 全部通过；1 存在失败；2 仅存在无法判定；3 参数或运行错误。

import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { runAudit } from '../core/runner.mjs'
import { renderHuman, renderJson } from '../core/report.mjs'

// 项目约束：仅允许本地隔离 Broker（数字回环地址）。core 层另有一道独立校验。
const ALLOWED_HOST = '127.0.0.1'

function usage(exitCode) {
  const text = [
    '用法: node cli/run-audit.mjs --source HOST:PORT --target HOST:PORT --creds FILE --cases FILE [--json FILE] [--witness NAME]',
    '',
    '  --source    源端（迁移前）Broker 地址，例如 127.0.0.1:11883',
    '  --target    目标端（迁移后）Broker 地址，例如 127.0.0.1:2883',
    '  --creds     身份→合成口令映射 JSON（不入仓库）',
    '  --cases     固定案例集 JSON（fixtures/cases/）',
    '  --json      可选，机器可读结果输出路径',
    '  --witness   可选，送达见证身份名，默认 auditor',
  ].join('\n')
  console.error(text)
  process.exit(exitCode)
}

export function parseEndpoint(value, label) {
  const m = /^(.+):(\d+)$/.exec(value ?? '')
  if (!m) throw new Error(`${label} 地址格式应为 HOST:PORT，收到: ${value}`)
  const host = m[1]
  if (host !== ALLOWED_HOST) {
    throw new Error(`${label} 仅允许数字回环地址 ${ALLOWED_HOST}（拒绝 localhost、域名、非回环 IP 与其他主机），收到: ${host}`)
  }
  return { host, port: Number(m[2]) }
}

function parseArgs(argv) {
  const args = {}
  for (let i = 0; i < argv.length; i += 2) {
    const key = argv[i]
    if (!key.startsWith('--')) throw new Error(`未知参数: ${key}`)
    args[key.slice(2)] = argv[i + 1]
  }
  if (!args.source || !args.target || !args.creds || !args.cases) usage(3)
  return args
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  const creds = JSON.parse(readFileSync(args.creds, 'utf8'))
  const caseSet = JSON.parse(readFileSync(args.cases, 'utf8'))
  const result = await runAudit({
    caseSet,
    brokers: {
      source: { ...parseEndpoint(args.source, '--source'), label: 'source-mosquitto' },
      target: { ...parseEndpoint(args.target, '--target'), label: 'target-emqx' },
    },
    creds,
    witness: args.witness ?? 'auditor',
  })
  console.log(renderHuman(result))
  if (args.json) {
    writeFileSync(args.json, renderJson(result), 'utf8')
    console.error(`\nJSON 结果已写入 ${args.json}`)
  }
  process.exit(result.summary.overall === 'pass' ? 0 : result.summary.overall === 'fail' ? 1 : 2)
}

const isEntry =
  process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
if (isEntry) {
  main().catch((err) => {
    console.error(`运行错误: ${err.message}`)
    process.exit(3)
  })
}
