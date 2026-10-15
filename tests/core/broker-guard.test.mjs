import test from 'node:test'
import assert from 'node:assert/strict'
import { runAudit, validateBroker, ALLOWED_BROKER_HOST } from '../../core/runner.mjs'

const caseSet = {
  id: 'g',
  description: '地址守卫测试',
  requirements: [],
  checks: [{ id: 'p1', identity: 'u', action: 'publish', topic: 'a/1', expect: 'allow' }],
}
const creds = { u: 'x', auditor: 'y' }
const goodBroker = (port) => ({ host: '127.0.0.1', port, label: 'b' })

test('validateBroker：唯一合法主机为数字回环地址 127.0.0.1', () => {
  validateBroker(goodBroker(1883), '源端') // 不抛错
  for (const host of ['localhost', '::1', '[::1]', '0.0.0.0', '192.168.1.5', '10.0.0.1', 'broker.example.com', '', undefined, null]) {
    assert.throws(() => validateBroker({ host, port: 1883 }, '源端'), /127\.0\.0\.1/, `host=${host} 应被拒绝`)
  }
  assert.equal(ALLOWED_BROKER_HOST, '127.0.0.1')
})

test('validateBroker：端口必须是 1–65535 整数', () => {
  for (const port of [0, -1, 65536, 1883.5, '1883', undefined]) {
    assert.throws(() => validateBroker({ host: '127.0.0.1', port }, '源端'), /端口非法/)
  }
  validateBroker({ host: '127.0.0.1', port: 1 }, '源端')
  validateBroker({ host: '127.0.0.1', port: 65535 }, '源端')
})

test('runAudit：非法地址在任何健康检查或连接之前被拒绝', async () => {
  let healthCalls = 0
  let probeCalls = 0
  const health = async () => {
    healthCalls += 1
    return { ok: true, detail: 'fake' }
  }
  const probes = {
    publish: async () => {
      probeCalls += 1
      return { observed: 'allow', reason: 'r', evidence: {} }
    },
    subscribe: async () => ({ observed: 'allow', reason: 'r', evidence: {} }),
  }
  for (const host of ['localhost', '0.0.0.0', '192.168.1.5', 'broker.example.com', '::1']) {
    await assert.rejects(
      runAudit({
        caseSet,
        brokers: { source: goodBroker(11883), target: { host, port: 12883, label: 't' } },
        creds,
        probes,
        health,
      }),
      /127\.0\.0\.1/,
      `目标端 ${host} 应被拒绝`,
    )
  }
  assert.equal(healthCalls, 0, '健康检查不得被调用')
  assert.equal(probeCalls, 0, '探针不得被调用')
})

test('runAudit：合法回环地址可通过守卫进入运行器', async () => {
  let healthCalls = 0
  const result = await runAudit({
    caseSet,
    brokers: { source: goodBroker(11883), target: goodBroker(12883) },
    creds,
    probes: {
      publish: async () => ({ observed: 'allow', reason: 'r', evidence: {} }),
      subscribe: async () => ({ observed: 'allow', reason: 'r', evidence: {} }),
    },
    health: async () => {
      healthCalls += 1
      return { ok: true, detail: 'fake' }
    },
  })
  assert.equal(healthCalls, 2, '两端健康检查应各执行一次')
  assert.equal(result.checks[0].sides.source.observed, 'allow')
})
