import test from 'node:test'
import assert from 'node:assert/strict'
import { combineCheck, summarize } from '../../core/runner.mjs'

const baseCheck = { id: 'c1', identity: 'u', action: 'publish', topic: 't/x', expect: 'allow' }
const obs = (observed, reason = 'r') => ({ observed, reason, evidence: {} })

test('两端允许且期望允许 → 通过，无扩大无受损', () => {
  const r = combineCheck(baseCheck, obs('allow'), obs('allow'))
  assert.equal(r.requirement, 'pass')
  assert.equal(r.expansion, false)
  assert.equal(r.damage, false)
})

test('源端拒绝、目标端允许 → 失败 + 权限扩大（即使期望允许）', () => {
  const r = combineCheck(baseCheck, obs('deny'), obs('allow'))
  assert.equal(r.sides.source.requirement, 'fail')
  assert.equal(r.sides.target.requirement, 'pass')
  assert.equal(r.requirement, 'fail')
  assert.equal(r.expansion, true)
})

test('期望允许、目标端拒绝 → 失败 + 业务受损', () => {
  const r = combineCheck(baseCheck, obs('allow'), obs('deny'))
  assert.equal(r.requirement, 'fail')
  assert.equal(r.damage, true)
  assert.equal(r.expansion, false)
})

test('任一端无法判定且无失败 → 无法判定，不算扩大/受损', () => {
  const r = combineCheck(baseCheck, obs('unknown', 'broker-unavailable'), obs('allow'))
  assert.equal(r.sides.source.requirement, 'unknown')
  assert.equal(r.requirement, 'unknown')
  assert.equal(r.expansion, false)
  assert.equal(r.damage, false)
})

test('两端都拒绝且期望拒绝 → 通过', () => {
  const denyCheck = { ...baseCheck, expect: 'deny' }
  const r = combineCheck(denyCheck, obs('deny'), obs('deny'))
  assert.equal(r.requirement, 'pass')
  assert.equal(r.expansion, false)
})

test('summarize 维度计数与总体优先级：失败 > 无法判定 > 通过', () => {
  const ok = combineCheck(baseCheck, obs('allow'), obs('allow'))
  const exp = combineCheck({ ...baseCheck, id: 'c2', expect: 'deny' }, obs('deny'), obs('allow'))
  const unk = combineCheck({ ...baseCheck, id: 'c3' }, obs('unknown', 'broker-unavailable'), obs('allow'))
  const s = summarize([ok, exp, unk])
  assert.deepEqual(s.expansion.map((e) => e.checkId), ['c2'])
  assert.equal(s.overall, 'fail')
  const s2 = summarize([ok, unk])
  assert.equal(s2.overall, 'unknown')
  const s3 = summarize([ok])
  assert.equal(s3.overall, 'pass')
  assert.equal(s3.passCount, 1)
})

test('仅业务受损（无扩大、无期望失败之外的异常）也使总体为失败', () => {
  const dmg = combineCheck({ ...baseCheck, id: 'c9' }, obs('allow'), obs('deny'))
  const s = summarize([dmg])
  assert.deepEqual(s.damage.map((d) => d.checkId), ['c9'])
  assert.equal(s.overall, 'fail')
})
