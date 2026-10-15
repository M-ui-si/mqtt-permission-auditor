import path from 'node:path'
import { CHECK_IDS } from './run-store.mjs'

export const JEV_URL = 'https://api.typesafe.ai/v1/systemone'
export const JEV_MODEL = 'jev-1.13.0'
const MAX_RESPONSE_BYTES = 32 * 1024

async function readBoundedJson(response) {
  const declaredSize = Number(response.headers?.get?.('content-length'))
  if (Number.isFinite(declaredSize) && declaredSize > MAX_RESPONSE_BYTES) throw new Error('oversized-response')
  if (!response.body?.getReader) throw new Error('invalid-response')
  const reader = response.body.getReader(), chunks = []
  let total = 0
  try {
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      total += value.byteLength
      if (total > MAX_RESPONSE_BYTES) throw new Error('oversized-response')
      chunks.push(value)
    }
  } catch (error) {
    await reader.cancel().catch(() => {})
    throw error
  } finally { reader.releaseLock() }
  return JSON.parse(Buffer.concat(chunks, total).toString('utf8'))
}

export async function planNext({ store, runId, env = process.env, fetchImpl = fetch, timeoutMs = 10000 }) {
  let release, state
  const unavailable = reason => {
    if (state && state.status !== 'running') { try { store.emit(runId, { type: 'jev.unavailable', available: false, reason }) } catch {} }
    return { status: 'unavailable', available: false, reason, message: 'Jev 建议不可用，由 Agnes 继续规划。' }
  }
  try {
    state = store.status(runId)
    if (env.MQTT_AUDIT_JEV_ENABLED !== 'true') return unavailable('disabled')
    // Access the configured key only inside the enabled server-side request path.
    if (!env.TYPESAFE_API_KEY) return unavailable('missing-key')
    if (state.status === 'running') return unavailable('run-in-progress')
    release = store.lock(`jev-${state.rootRunId}`)
    const budgetFile = path.join(store.directory, `${state.rootRunId}.jev-budget.json`)
    let used = 0
    try { used = store.read(budgetFile).used } catch (error) { if (error.code !== 'ENOENT') throw error }
    if (used >= 3) return unavailable('call-limit')
    store.write(budgetFile, { used: used + 1 })
    let report
    if (state.status === 'completed') report = store.read(store.file(runId, 'json'))
    const checks = (report?.checks ?? []).filter(c => CHECK_IDS.includes(c.checkId)).map(c => ({ checkId: c.checkId, requirement: c.requirement, source: c.sides?.source?.observed, target: c.sides?.target?.observed }))
    const criteria = { evidence: '查看已有证据', wait: '等待本地环境恢复', finish: '结束本轮并说明剩余未知项' }
    if (state.status === 'prepared') for (const id of state.checkIds) criteria[`check_${id}`] = `下一项关注 ${id}；首次执行仍须完整覆盖 c1–c8`
    if (state.round < 2 && state.status === 'completed') for (const check of checks.filter(c => c.requirement !== 'pass')) criteria[`retest_${check.checkId}`] = `由 Agnes 判断环境条件是否改变后复测 ${check.checkId}`
    const response = await fetchImpl(JEV_URL, { method: 'POST', headers: { Authorization: `Bearer ${env.TYPESAFE_API_KEY}`, 'Content-Type': 'application/json' }, signal: AbortSignal.timeout(timeoutMs), body: JSON.stringify({ model: JEV_MODEL, state: { caseId: 'migration-baseline', phase: state.status, round: state.round, checks }, questions: { next_action: { type: 'choice', instructions: '为固定本地 MQTT 迁移验收建议下一步。协议证据不足本身不代表拒绝；条件不变时避免反复复测。你不执行工具，不判定权限。', criteria } } }) })
    if (!response.ok) throw new Error('request-failed')
    const body = await readBoundedJson(response)
    const answer = body?.answers?.next_action
    if (answer?.type !== 'choice' || !Object.hasOwn(criteria, answer.choice) || !Number.isFinite(answer.confidence) || answer.confidence < 0 || answer.confidence > 1 || typeof body.model !== 'string' || body.model.length > 100) throw new Error('invalid-response')
    const probabilities = answer.probabilities
    if (!probabilities || typeof probabilities !== 'object' || Array.isArray(probabilities) || Object.keys(probabilities).length !== Object.keys(criteria).length || Object.entries(probabilities).some(([key, value]) => !Object.hasOwn(criteria, key) || !Number.isFinite(value) || value < 0 || value > 1) || Math.abs(Object.values(probabilities).reduce((a,b) => a+b,0) - 1) > 0.02) throw new Error('invalid-response')
    const advice = { type: 'jev.advice', available: true, choice: answer.choice, confidence: answer.confidence, probabilities, model: body.model }
    store.emit(runId, advice)
    return { status: 'ok', ...advice, description: criteria[answer.choice], adopted: false }
  } catch {
    return unavailable('request-failed-or-invalid')
  } finally { release?.() }
}
