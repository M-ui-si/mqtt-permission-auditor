import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, writeFileSync, readFileSync, rmSync, mkdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { buildToolDefs } from '../../plugins/agh/mqtt-audit-tools/index.mjs'
import { createLatestAuditService } from '../../plugins/agh/mqtt-audit-tools/dashboard-service.mjs'

function setup() {
  const dir = mkdtempSync(path.join(tmpdir(), 'mqttaudit-plugin-'))
  const creds = path.join(dir, 'creds.json')
  writeFileSync(creds, JSON.stringify({ auditor: 'a', 'device-sensor': 's', 'ops-admin': 'o', 'guest-ro': 'g', 'no-rules-user': 'n' }))
  const results = path.join(dir, 'agh-runs')
  return { dir, creds, results }
}

test('list_cases 返回固定案例集与期望值', async () => {
  const { creds, results } = setup()
  const tools = buildToolDefs({ packageRoot: path.resolve('plugins/agh/mqtt-audit-tools'), credsPath: creds, resultsDir: results })
  const list = tools.find((t) => t.name === 'mqtt_audit_list_cases')
  const out = await list.execute()
  assert.equal(out.structured.status, 'ok')
  assert.equal(out.structured.cases[0].id, 'migration-baseline')
  assert.equal(out.structured.cases[0].checks.length, 8)
  assert.ok(out.content[0].text.startsWith('{'))
})

test('run_check 走假 runner，返回结构化结果并落盘，read_result 内存可读', async () => {
  const { creds, results } = setup()
  const fakeResult = {
    schema: 'mqtt-permission-audit/1',
    generatedAt: '2026-10-07T00:00:00.000Z',
    caseSet: { id: 'migration-baseline', description: 'd', requirements: [] },
    brokers: { source: { label: 's', endpoint: '127.0.0.1:1883', health: { ok: true } }, target: { label: 't', endpoint: '127.0.0.1:2883', health: { ok: true } } },
    witness: 'auditor',
    checks: [],
    summary: { expansion: [], damage: [], requirementFailures: [], unknowns: [], passCount: 0, total: 0, overall: 'pass' },
    scope: [],
  }
  let received
  const tools = buildToolDefs({
    packageRoot: path.resolve('plugins/agh/mqtt-audit-tools'),
    credsPath: creds,
    resultsDir: results,
    runAuditImpl: async (args) => {
      received = args
      return structuredClone(fakeResult)
    },
  })
  const run = tools.find((t) => t.name === 'mqtt_audit_run_check')
  const out = await run.execute({ caseId: 'migration-baseline' })
  assert.equal(out.structured.summary.overall, 'pass')
  assert.match(out.structured.runId, /^run-/)
  assert.equal(received.brokers.source.port, 11883)
  assert.equal(received.brokers.target.port, 2883)
  assert.equal(received.witness, 'auditor')

  const stored = JSON.parse(readFileSync(path.join(results, `${out.structured.runId}.json`), 'utf8'))
  assert.equal(stored.runId, out.structured.runId)

  const read = tools.find((t) => t.name === 'mqtt_audit_read_result')
  const reread = await read.execute({ runId: out.structured.runId })
  assert.equal(reread.structured.runId, out.structured.runId)
})

test('creds 缺失 → 结构化错误而非异常泄露', async () => {
  const { creds, results } = setup()
  rmSync(creds)
  const tools = buildToolDefs({ packageRoot: path.resolve('plugins/agh/mqtt-audit-tools'), credsPath: creds, resultsDir: results })
  const run = tools.find((t) => t.name === 'mqtt_audit_run_check')
  const out = await run.execute({ caseId: 'migration-baseline' })
  assert.equal(out.structured.status, 'error')
  assert.equal(out.structured.code, 'creds-unavailable')
})

test('read_result 未知 runId → 结构化 not-found', async () => {
  const { creds, results } = setup()
  const tools = buildToolDefs({ packageRoot: path.resolve('plugins/agh/mqtt-audit-tools'), credsPath: creds, resultsDir: results })
  const read = tools.find((t) => t.name === 'mqtt_audit_read_result')
  const out = await read.execute({ runId: 'run-nope' })
  assert.equal(out.structured.code, 'result-not-found')
})

test('read_result 从结果目录冷读（跨进程场景）', async () => {
  const { creds, results } = setup()
  mkdirSync(results, { recursive: true })
  writeFileSync(path.join(results, 'run-cold.json'), JSON.stringify({ schema: 'mqtt-permission-audit/1', runId: 'run-cold' }))
  const tools = buildToolDefs({ packageRoot: path.resolve('plugins/agh/mqtt-audit-tools'), credsPath: creds, resultsDir: results })
  const read = tools.find((t) => t.name === 'mqtt_audit_read_result')
  const out = await read.execute({ runId: 'run-cold' })
  assert.equal(out.structured.runId, 'run-cold')
})

test('参数 Schema 用 pattern 锁定枚举且禁止附加属性', () => {
  const { creds, results } = setup()
  const tools = buildToolDefs({ packageRoot: path.resolve('plugins/agh/mqtt-audit-tools'), credsPath: creds, resultsDir: results })
  const run = tools.find((t) => t.name === 'mqtt_audit_run_check')
  assert.equal(run.parameters.additionalProperties, false)
  assert.equal(run.parameters.properties.caseId.pattern, '^migration-baseline$')
  assert.equal(run.parameters.properties.instanceId.pattern, '^local-isolated$')
  assert.equal(run.meta.isReadOnly, false)
  assert.equal(run.meta.isOpenWorld, false)
  assert.equal(run.meta.requiresApproval, 'never')
})

test('每次工具运行写入高熵 runId 报告，面板能按轨迹引用读取且不依赖 sessionId 参数', async () => {
  const { dir, creds, results } = setup()
  try {
    let finish
    const tools = buildToolDefs({ credsPath: creds, resultsDir: results, runAuditImpl: () => new Promise((resolve) => { finish = resolve }) })
    const running = tools.find((tool) => tool.name === 'mqtt_audit_run_check').execute({ caseId: 'migration-baseline' })
    const service = createLatestAuditService(results)
    finish({ schema: 'mqtt-permission-audit/1', checks: [], summary: { overall: 'unknown' }, generatedAt: new Date().toISOString() })
    const output = await running
    const resultPreview = output.content[0].text
    assert.match(resultPreview, new RegExp(`^\\{\\"runId\\":\\"${output.structured.runId}\\"`))
    const shown = await service.handler({ runId: output.structured.runId })
    assert.equal(shown.status, 'ok')
    assert.equal(shown.result.runId, output.structured.runId)
    assert.equal((await service.handler({ sessionId: 'session-a' })).status, 'error')
  } finally { rmSync(dir, { recursive: true, force: true }) }
})

test('工具异常携带 runId 且不生成可展示的报告', async () => {
  const { dir, creds, results } = setup()
  try {
    const tools = buildToolDefs({ credsPath: creds, resultsDir: results, runAuditImpl: async () => { throw new Error('synthetic failure') } })
    const output = await tools[1].execute({ caseId: 'migration-baseline' }, { session: { key: 'failed-session' } })
    assert.equal(output.structured.code, 'run-failed')
    assert.match(output.structured.runId, /^run-/)
    assert.equal((await createLatestAuditService(results).handler({ runId: output.structured.runId })).status, 'empty')
  } finally { rmSync(dir, { recursive: true, force: true }) }
})

test('工具直接调用仍拒绝路径穿越，不依赖宿主 schema 校验', async () => {
  const { dir, creds, results } = setup()
  try {
    const tools = buildToolDefs({ credsPath: creds, resultsDir: results })
    assert.equal((await tools[1].execute({ caseId: '../../../package' })).structured.code, 'invalid-selection')
    assert.equal((await tools[2].execute({ runId: '../creds' })).structured.code, 'invalid-run-id')
  } finally { rmSync(dir, { recursive: true, force: true }) }
})
