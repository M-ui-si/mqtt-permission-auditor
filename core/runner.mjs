// 案例运行器：健康门控 → 双端探针 → 三态聚合与维度汇总。
// 三态语义（与架构文档一致）：
// - 单项检查结论 = 通过 / 失败 / 无法判定，取两端最坏（失败 > 无法判定 > 通过）。
// - 超时、连接失败、证据缺失只能产生"无法判定"，不得推导为拒绝或通过。
// - 权限扩大 = 源端观测拒绝且目标端观测允许（与期望无关，单列维度）。
// - 业务受损 = 业务要求允许、目标端观测拒绝。

import { MqttClient } from './mqtt-client.mjs'
import { probePublish, probeSubscribe } from './prober.mjs'
import { randomUUID } from 'node:crypto'

export const WORST_ORDER = { fail: 2, unknown: 1, pass: 0 }

// 项目约束：只允许连接本地隔离 Broker。固定为数字回环地址 127.0.0.1，
// 拒绝 localhost、域名、非回环 IP、0.0.0.0 与其他主机地址。
export const ALLOWED_BROKER_HOST = '127.0.0.1'

export function validateBroker(broker, label) {
  const host = broker?.host
  if (host !== ALLOWED_BROKER_HOST) {
    throw new Error(
      `${label} Broker 地址必须是数字回环地址 ${ALLOWED_BROKER_HOST}（拒绝 localhost、域名、非回环 IP、0.0.0.0 与其他主机），收到: ${host ?? '(缺失)'}`,
    )
  }
  if (!Number.isInteger(broker.port) || broker.port < 1 || broker.port > 65535) {
    throw new Error(`${label} Broker 端口非法: ${broker?.port}`)
  }
}

export function sideRequirementResult(observed, expect) {
  if (observed.observed === 'unknown') return 'unknown'
  const allowed = observed.observed === 'allow'
  if ((expect === 'allow') === allowed) return 'pass'
  return 'fail'
}

export function combineCheck(check, sourceObserved, targetObserved) {
  const sides = { source: sourceObserved, target: targetObserved }
  const sideResults = {}
  for (const [side, obs] of Object.entries(sides)) {
    sideResults[side] = { observed: obs.observed, reason: obs.reason ?? null, requirement: sideRequirementResult(obs, check.expect) }
  }
  const levels = Object.values(sideResults).map((s) => WORST_ORDER[s.requirement])
  const requirement = levels.includes(WORST_ORDER.fail) ? 'fail' : levels.includes(WORST_ORDER.unknown) ? 'unknown' : 'pass'
  const expansion =
    sourceObserved.observed === 'deny' && targetObserved.observed === 'allow'
  const damage = check.expect === 'allow' && targetObserved.observed === 'deny'
  return {
    checkId: check.id,
    identity: check.identity,
    action: check.action,
    topic: check.action === 'publish' ? check.topic : check.filter,
    expect: check.expect,
    sides: sideResults,
    evidence: { source: sourceObserved.evidence ?? {}, target: targetObserved.evidence ?? {} },
    requirement,
    expansion,
    damage,
  }
}

export function summarize(checkResults) {
  const expansion = checkResults.filter((r) => r.expansion).map((r) => ({ checkId: r.checkId, identity: r.identity, action: r.action, topic: r.topic }))
  const damage = checkResults.filter((r) => r.damage).map((r) => ({ checkId: r.checkId, identity: r.identity, action: r.action, topic: r.topic }))
  const requirementFailures = []
  const unknowns = []
  let passCount = 0
  for (const r of checkResults) {
    for (const side of ['source', 'target']) {
      const req = r.sides[side].requirement
      if (req === 'fail') requirementFailures.push({ checkId: r.checkId, side })
      else if (req === 'unknown') unknowns.push({ checkId: r.checkId, side, reason: r.sides[side].reason })
    }
    if (r.requirement === 'pass') passCount += 1
  }
  const anyFail = checkResults.some((r) => r.requirement === 'fail') || expansion.length > 0 || damage.length > 0
  const anyUnknown = checkResults.some((r) => r.requirement === 'unknown')
  const overall = anyFail ? 'fail' : anyUnknown ? 'unknown' : 'pass'
  return { expansion, damage, requirementFailures, unknowns, passCount, total: checkResults.length, overall }
}

export async function healthCheck({ broker, witness, witnessPassword, timeoutMs = 4000 }) {
  try {
    const client = await MqttClient.connect({
      host: broker.host,
      port: broker.port,
      username: witness,
      password: witnessPassword,
      clientId: `mqttaudit-health-${Math.random().toString(16).slice(2, 8)}`,
      timeoutMs,
    })
    client.close()
    return { ok: true, detail: 'witness connected' }
  } catch (err) {
    return { ok: false, detail: err.message }
  }
}

export async function runAudit({
  caseSet,
  brokers,
  creds,
  witness = 'auditor',
  timeouts = {},
  probes = { publish: probePublish, subscribe: probeSubscribe },
  health = healthCheck,
  onEvent = () => {},
  runId = randomUUID(),
}) {
  const startedAt = new Date().toISOString()
  // 边界校验必须先于任何健康检查或网络连接发生，不依赖 CLI 层的把关。
  validateBroker(brokers.source, '源端')
  validateBroker(brokers.target, '目标端')
  const sideHealth = {}
  for (const side of ['source', 'target']) {
    sideHealth[side] = await health({ broker: brokers[side], witness, witnessPassword: creds[witness], timeouts })
    onEvent({ type: 'health.observed', side, role: 'broker', ok: sideHealth[side].ok })
  }

  const unavailableSide = (side, reason) => ({
    observed: 'unknown',
    reason,
    evidence: { brokerUnavailable: sideHealth[side].detail },
  })

  const checkResults = []
  for (const check of caseSet.checks) {
    onEvent({ type: 'check.started', checkId: check.id, identity: check.identity, action: check.action, topic: check.topic ?? check.filter })
    const perSide = {}
    for (const side of ['source', 'target']) {
      if (!sideHealth[side].ok) {
        perSide[side] = unavailableSide(side, 'broker-unavailable')
        onEvent({ type: 'verdict', checkId: check.id, side, observed: 'unknown', reason: 'broker-unavailable' })
        continue
      }
      const args = {
        broker: brokers[side],
        identity: check.identity,
        password: creds[check.identity],
        witness,
        witnessPassword: creds[witness],
        tag: `${runId}:${check.id}:${side}`,
        onEvent: event => onEvent({ ...event, checkId: check.id, side, correlationId: `${runId}:${check.id}:${side}` }),
        timeouts,
      }
      if (check.action === 'publish') {
        perSide[side] = await probes.publish({ ...args, topic: check.topic })
      } else if (check.action === 'subscribe') {
        perSide[side] = await probes.subscribe({
          ...args,
          filter: check.filter,
          publisher: check.publisher,
          publisherPassword: creds[check.publisher],
          publishTopic: check.publishTopic ?? check.filter,
        })
      } else {
        perSide[side] = { observed: 'unknown', reason: `unsupported-action:${check.action}`, evidence: {} }
      }
      onEvent({ type: 'verdict', checkId: check.id, side, observed: perSide[side].observed, reason: perSide[side].reason?.split(':')[0] })
    }
    checkResults.push(combineCheck(check, perSide.source, perSide.target))
    onEvent({ type: 'check.ended', checkId: check.id, requirement: checkResults.at(-1).requirement })
  }

  return {
    schema: 'mqtt-permission-audit/1',
    generatedAt: startedAt,
    caseSet: { id: caseSet.id, description: caseSet.description, requirements: caseSet.requirements ?? [] },
    brokers: {
      source: { label: brokers.source.label ?? 'source', endpoint: `${brokers.source.host}:${brokers.source.port}`, health: sideHealth.source },
      target: { label: brokers.target.label ?? 'target', endpoint: `${brokers.target.host}:${brokers.target.port}`, health: sideHealth.target },
    },
    witness,
    checks: checkResults,
    summary: summarize(checkResults),
    scope: caseSet.scope ?? [],
  }
}
