import test from 'node:test'
import assert from 'node:assert/strict'
import { runAudit } from '../../core/runner.mjs'

const caseSet = {
  id: 't',
  description: '测试案例集',
  requirements: ['r1'],
  checks: [
    { id: 'p1', identity: 'u1', action: 'publish', topic: 'a/1', expect: 'allow' },
    { id: 'p2', identity: 'u1', action: 'publish', topic: 'a/2', expect: 'deny' },
    {
      id: 's1',
      identity: 'u2',
      action: 'subscribe',
      filter: 'a/#',
      publisher: 'u1',
      publishTopic: 'a/1',
      expect: 'allow',
    },
  ],
}

const creds = { u1: 'p1', u2: 'p2', auditor: 'pw' }
const brokers = {
  source: { host: '127.0.0.1', port: 11883, label: 'src' },
  target: { host: '127.0.0.1', port: 12883, label: 'tgt' },
}

function makeProbes(sourceMap, targetMap) {
  const impl = (map) => async (args) => {
    const key = `${args.broker.port}:${args.tag.split(':')[1]}:${args.broker.port === brokers.source.port ? '' : ''}`
    const checkId = args.tag.split(':')[1]
    const m = map[checkId] ?? 'allow'
    const observed = typeof m === 'string' ? m : m(args)
    return { observed, reason: observed === 'unknown' ? 'broker-unavailable' : 'synthetic', evidence: { synthetic: true } }
  }
  return { publish: impl(sourceMap), subscribe: impl(targetMap) }
}

test('runAudit 聚合真实形状的假探针结果并传递 tag/身份', async () => {
  const seen = []
  const probes = {
    publish: async (args) => {
      seen.push(args.tag)
      return args.broker.port === 11883
        ? { observed: 'deny', reason: 'puback-without-delivery', evidence: {} }
        : { observed: 'allow', reason: 'witness-received-message', evidence: {} }
    },
    subscribe: async (args) => ({ observed: 'allow', reason: 'subscriber-received-message', evidence: {} }),
  }
  const result = await runAudit({
    caseSet,
    brokers,
    creds,
    probes,
    health: async () => ({ ok: true, detail: 'fake' }),
  })
  assert.deepEqual(seen[0].split(':')[1], 'p1')
  const p2 = result.checks.find((c) => c.checkId === 'p2')
  assert.equal(p2.sides.source.observed, 'deny')
  assert.equal(p2.sides.target.observed, 'allow')
  assert.equal(p2.expansion, true)
  assert.equal(result.summary.overall, 'fail')
  assert.ok(result.checks.every((c) => c.checkId && c.sides.source && c.sides.target))
})

test('目标端健康检查失败 → 目标侧全部无法判定，总体无法判定且不算扩大', async () => {
  // 源端观测与期望一致（p1 允许 / p2 拒绝 / s1 允许），确保总体只受目标端未知项影响。
  const probes = makeProbes({ p1: 'allow', p2: 'deny', s1: 'allow' }, { s1: 'allow' })
  const result = await runAudit({
    caseSet,
    brokers,
    creds,
    probes,
    health: async ({ broker }) =>
      broker.port === 12883 ? { ok: false, detail: 'connect ECONNREFUSED' } : { ok: true, detail: 'fake' },
  })
  for (const c of result.checks) {
    assert.equal(c.sides.target.observed, 'unknown')
    assert.equal(c.sides.target.reason, 'broker-unavailable')
    assert.equal(c.sides.target.requirement, 'unknown')
  }
  assert.equal(result.brokers.target.health.ok, false)
  assert.deepEqual(result.summary.expansion, [])
  assert.equal(result.summary.overall, 'unknown')
})

test('不支持的 action → 无法判定而非崩溃', async () => {
  const bad = { id: 'x1', identity: 'u1', action: 'shell', topic: 'a', expect: 'allow' }
  const result = await runAudit({
    caseSet: { ...caseSet, checks: [bad] },
    brokers,
    creds,
    probes: makeProbes({}, {}),
    health: async () => ({ ok: true, detail: 'fake' }),
  })
  assert.equal(result.checks[0].sides.source.reason, 'unsupported-action:shell')
  assert.equal(result.summary.overall, 'unknown')
})

test('订阅探针收到 publisher/filter/publishTopic 参数', async () => {
  let got = null
  const probes = {
    publish: async () => ({ observed: 'allow', reason: 'r', evidence: {} }),
    subscribe: async (args) => {
      got = args
      return { observed: 'deny', reason: 'suback-0x80-denied', evidence: {} }
    },
  }
  const result = await runAudit({ caseSet, brokers, creds, probes, health: async () => ({ ok: true, detail: 'f' }) })
  assert.equal(got.filter, 'a/#')
  assert.equal(got.publishTopic, 'a/1')
  assert.equal(got.publisher, 'u1')
  const s1 = result.checks.find((c) => c.checkId === 's1')
  assert.equal(s1.sides.target.reason, 'suback-0x80-denied')
})
