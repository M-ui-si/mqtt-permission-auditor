import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { createLatestAuditService } from '../../plugins/agh/mqtt-audit-tools/dashboard-service.mjs'
import { filterAuditChecks, isAuditResultStale, summarizeAuditResult } from '../../plugins/agh/mqtt-audit-tools/dashboard-model.mjs'
import { auditDashboardRuntime } from '../../plugins/agh/mqtt-audit-tools/index.mjs'
import { readSessionDashboard } from '../../plugins/agh/mqtt-audit-tools/dashboard-session.mjs'

function fixtureResult(runId, overall = 'unknown') {
  return {
    schema: 'mqtt-permission-audit/1',
    runId,
    generatedAt: '2026-10-08T12:00:00.000Z',
    checks: [
      {
        checkId: 'c1',
        requirement: 'unknown',
        expansion: false,
        damage: false,
        sides: { source: { observed: 'unknown' }, target: { observed: 'unknown' } },
      },
      {
        checkId: 'c3',
        requirement: 'fail',
        expansion: false,
        damage: false,
        sides: { source: { observed: 'unknown' }, target: { observed: 'allow' } },
      },
    ],
    summary: {
      overall,
      expansion: [],
      damage: [],
      requirementFailures: [{ checkId: 'c3', side: 'target' }],
    },
  }
}

test('仪表盘统计保留三态语义且未知项不被计成拒绝', () => {
  const result = fixtureResult('run-a')
  const summary = summarizeAuditResult(result)
  assert.equal(summary.totalChecks, 2)
  assert.equal(summary.unknownChecks, 2)
  assert.equal(summary.source.unknown, 2)
  assert.equal(summary.target.allow, 1)
  assert.equal(summary.target.deny, 0)
  assert.equal(summary.expansion, 0)
})

test('仪表盘按确定性结果分类筛选，不重算 ACL 结论', () => {
  const checks = fixtureResult('run-a').checks
  assert.deepEqual(filterAuditChecks(checks, 'unknown').map((row) => row.checkId), ['c1', 'c3'])
  assert.deepEqual(filterAuditChecks(checks, 'fail').map((row) => row.checkId), ['c3'])
  assert.deepEqual(filterAuditChecks(checks, 'expansion'), [])
  assert.equal(filterAuditChecks(checks, 'all').length, 2)
})

test('仪表盘显式标记缺失时间或超过 15 分钟的旧报告', () => {
  const now = Date.parse('2026-10-08T12:15:00.000Z')
  assert.equal(isAuditResultStale(fixtureResult('run-current'), now), false)
  assert.equal(isAuditResultStale({ generatedAt: '2026-10-08T12:00:00.000Z' }, now), false)
  assert.equal(isAuditResultStale({ generatedAt: '2026-10-08T11:59:59.999Z' }, now), true)
  assert.equal(isAuditResultStale({ generatedAt: 'invalid' }, now), true)
})

test('面板只按随机 runId 读取当前会话轨迹引用的报告', async () => {
  const root = mkdtempSync(path.join(tmpdir(), 'mqtt-audit-dashboard-'))
  const resultsDir = path.join(root, 'agh-runs')
  mkdirSync(resultsDir)
  try {
    for (const id of ['a', 'b']) writeFileSync(path.join(resultsDir, `run-${id}.json`), JSON.stringify(fixtureResult(`run-${id}`)))
    writeFileSync(path.join(resultsDir, 'run-global.json'), JSON.stringify(fixtureResult('run-global')))

    const service = createLatestAuditService(resultsDir)
    assert.equal(service.kind, 'query')
    assert.equal(service.name, 'mqtt.audit.latestresult')
    assert.deepEqual(service.inputSchema.required, ['runId'])
    assert.equal(service.inputSchema.additionalProperties, false)
    assert.equal((await service.handler({ runId: 'run-a' })).result.runId, 'run-a')
    assert.equal((await service.handler({ runId: 'run-b' })).result.runId, 'run-b')
    assert.equal((await service.handler({ runId: 'run-c' })).status, 'empty')
    assert.equal((await service.handler({ folder: '..' })).status, 'error')
    assert.equal((await service.handler({})).status, 'error')
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test('latest-result query 忽略不属于审计结果的 JSON，不暴露本地路径', async () => {
  const root = mkdtempSync(path.join(tmpdir(), 'mqtt-audit-dashboard-empty-'))
  try {
    writeFileSync(path.join(root, 'notes.json'), JSON.stringify({ secret: 'not an audit result' }))
    const service = createLatestAuditService(root)
    assert.deepEqual(await service.handler({ runId: 'run-absent' }), { status: 'empty', message: '当前会话尚无已完成的 MQTT 验收报告。' })
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test('AGH client panel 通过同一受信服务行声明右侧面板与只读查询', () => {
  const root = path.resolve('plugins/agh/mqtt-audit-tools')
  const manifest = JSON.parse(readFileSync(path.join(root, 'package.json'), 'utf8'))
  const descriptor = JSON.parse(readFileSync(path.join(root, 'extensions/dashboard/agnes.client.json'), 'utf8'))
  const service = manifest.agnes.plugins.find((row) => row.id === 'ext:mqtt-audit-tools/dashboard-service')
  assert.ok(service)
  assert.equal(service.runtime, 'in-process')
  assert.deepEqual(service.services, ['mqtt.audit.latestresult', 'mqtt.audit.runstatus', 'mqtt.audit.events', 'mqtt.audit.health'])
  assert.equal(manifest.agnes.clientDescriptors[0].rowId, service.id)
  assert.equal(descriptor.client.slotCatalogVersion, 'dsh-client-slots/v1')
  assert.deepEqual(descriptor.client.slots, ['rightbar', 'sidebar.panellist', 'shell.overlay'])
  assert.deepEqual(descriptor.client.services, service.services)
  for (const file of [descriptor.client.entry, ...descriptor.client.styles]) {
    assert.ok(readFileSync(path.resolve(root, 'extensions/dashboard', file), 'utf8').length)
  }
})

test('会话适配器只读取本次运行且轨迹不泄露原始参数', async () => {
  const requested = []
  const nodes = [
    { kind: 'tool', name: 'other_tool', resultPreview: '{"runId":"run-other"}' },
    { kind: 'tool', name: 'mqtt_audit_run_check', status: 'completed', seq: 2, resultPreview: '{"runId":"run-old"}' },
    { kind: 'tool', name: 'mqtt_audit_run_check', status: 'completed', seq: 3, args: { private: 'hidden' }, resultPreview: '{"runId":"run-new"}' },
  ]
  const callLatest = async (runId) => { requested.push(runId); return { status: 'ok', result: fixtureResult(runId) } }
  const read = (value) => readSessionDashboard({ sessionId: 'a', readProjection: async () => ({ status: 'available', value }), callLatest })
  const first = await read({ nodes })
  assert.equal(first.result.runId, 'run-new')
  assert.deepEqual(first.activity[1], { name: 'mqtt_audit_run_check', status: 'completed', seq: 3 })
  assert.deepEqual(requested, ['run-new'])
  assert.equal((await read({ nodes: [] })).status, 'empty')
  nodes.push({ kind: 'tool', name: 'mqtt_audit_run_check', status: 'running' })
  assert.equal((await read({ nodes })).status, 'running')
  nodes.at(-1).status = 'failed'
  assert.equal((await read({ nodes })).status, 'error')
  assert.deepEqual(requested, ['run-new'])
})

test('会话轨迹不可用不伪装为空，报告服务失败仍保留调用轨迹', async () => {
  let calls = 0
  const callLatest = async () => { calls++; throw new Error('unavailable') }
  const result = await readSessionDashboard({ sessionId: 'a', readProjection: async () => ({ status: 'unavailable' }), callLatest })
  assert.equal(result.status, 'unavailable')
  assert.equal(calls, 0)
  const failed = await readSessionDashboard({ sessionId: 'a', readProjection: async () => ({ status: 'available', value: { nodes: [
    { kind: 'tool', name: 'mqtt_audit_run_check', status: 'completed', resultPreview: '{"runId":"run-test"}' },
  ] } }), callLatest })
  assert.equal(failed.status, 'error')
  assert.equal(failed.activity.length, 1)
})

test('dashboard backend row 注册受限 query services 与生命周期 effect', () => {
  const registered = []
  let effect
  auditDashboardRuntime.apply({
    effect(fn) { effect = fn },
    services: {
      register(definition) {
        registered.push(definition)
      },
    },
  })
  assert.equal(registered.length, 4)
  assert.equal(typeof effect, 'function')
  assert.equal(registered[0].name, 'mqtt.audit.latestresult')
  for (const service of registered) { assert.equal(service.kind, 'query'); assert.equal(service.timeoutMs, 1500) }
  assert.deepEqual(registered[0].inputSchema.required, ['runId'])
})

test('报告服务拒绝异常标识和内容不匹配的报告', async () => {
  const root = mkdtempSync(path.join(tmpdir(), 'mqtt-session-'))
  try {
    const service = createLatestAuditService(root)
    writeFileSync(path.join(root, 'run-expected.json'), JSON.stringify(fixtureResult('run-other')))
    assert.equal((await service.handler({ runId: 'run-expected' })).status, 'error')
    assert.equal((await service.handler({ runId: '../secrets' })).status, 'error')
  } finally { rmSync(root, { recursive: true, force: true }) }
})
