import test from 'node:test'
import assert from 'node:assert/strict'
import {
  decidePublishVerdict,
  decideSubscribeVerdict,
  classifyIdentityConnectFailure,
} from '../../core/prober.mjs'
import { combineCheck } from '../../core/runner.mjs'

test('发布：PUBACK 且见证者收到消息 → 允许', () => {
  const v = decidePublishVerdict({ puback: true, delivered: true })
  assert.deepEqual(v, { observed: 'allow', reason: 'witness-received-message' })
})

test('发布：PUBACK 但未送达且无拒绝证据 → 无法判定（不得报拒绝）', () => {
  const v = decidePublishVerdict({ puback: true, delivered: false })
  assert.equal(v.observed, 'unknown')
  assert.equal(v.reason, 'puback-without-delivery-no-denial-evidence')
  assert.ok(v.limitation && v.limitation.includes('无法判定'))
})

test('发布：超时/连接中断（无 PUBACK 无送达）→ 无法判定', () => {
  const v = decidePublishVerdict({
    puback: false,
    delivered: false,
    failureReason: 'puback-error:PUBACK timeout after 4000ms',
  })
  assert.equal(v.observed, 'unknown')
  assert.match(v.reason, /puback-error/)
  const v2 = decidePublishVerdict({ puback: false, delivered: false })
  assert.equal(v2.observed, 'unknown')
  assert.equal(v2.reason, 'no-puback-and-no-delivery')
})

test('连接层拒绝：CONNACK 4（bad user name or password）对发布与订阅均为无法判定，保留证据码', () => {
  const cls = classifyIdentityConnectFailure({ connackCode: 4, message: 'CONNACK refused: bad user name or password (code 4)' })
  assert.equal(cls.observed, 'unknown', '发布/订阅共用本分类：连接层拒绝不得判拒绝')
  assert.match(cls.reason, /identity-connect-failed.*CONNACK code 4/)
  assert.equal(cls.evidence.connackCode, 4)
})

test('连接层拒绝：CONNACK 5（not authorised）同样为无法判定，不得冒充主题 ACL 拒绝', () => {
  const cls = classifyIdentityConnectFailure({ connackCode: 5, message: 'CONNACK refused: not authorised (code 5)' })
  assert.equal(cls.observed, 'unknown')
  assert.match(cls.reason, /CONNACK code 5/)
  assert.equal(cls.evidence.connackCode, 5)
})

test('连接层拒绝：未知连接失败（无 CONNACK 码，如 TCP 拒绝）→ 无法判定且不含证据码', () => {
  const cls = classifyIdentityConnectFailure(new Error('connect ECONNREFUSED 127.0.0.1:1883'))
  assert.equal(cls.observed, 'unknown')
  assert.match(cls.reason, /identity-connect-failed.*ECONNREFUSED/)
  assert.equal(cls.evidence.connackCode, undefined)
})

test('连接层拒绝不得计入权限扩大、业务受损或"要求拒绝"通过', () => {
  const check = { id: 'x1', identity: 'u', action: 'publish', topic: 't/1', expect: 'deny' }
  const source = classifyIdentityConnectFailure({ connackCode: 5, message: 'not authorised' })
  const target = decidePublishVerdict({ puback: true, delivered: true }) // 目标端实际送达
  const combined = combineCheck(check, source, target)
  assert.equal(combined.sides.source.observed, 'unknown')
  assert.equal(combined.sides.source.requirement, 'unknown', '期望拒绝时连接层拒绝不得判为通过')
  assert.equal(combined.expansion, false, '无源端主题级拒绝证据，不得报权限扩大')
  assert.equal(combined.damage, false)
  // 整体 fail 只能来自目标端的正向证据（禁止主题实际送达），不得由源端连接拒绝产生。
  assert.equal(combined.requirement, 'fail')
  // 对照：两端均为连接层拒绝时，整体必须为"无法判定"而非失败或通过。
  const bothRefused = combineCheck(check, source, classifyIdentityConnectFailure({ connackCode: 4, message: 'bad user name or password' }))
  assert.equal(bothRefused.requirement, 'unknown')
  assert.equal(bothRefused.expansion, false)
  assert.equal(bothRefused.damage, false)
})

test('订阅：订阅者收到消息 → 允许', () => {
  const v = decideSubscribeVerdict({ subackDenied: false, subackReceived: true, identityReceived: true, witnessReceived: true })
  assert.deepEqual(v, { observed: 'allow', reason: 'subscriber-received-message' })
})

test('订阅：SUBACK 0x80 仍为明确的主题级拒绝证据', () => {
  const v = decideSubscribeVerdict({ subackDenied: true, subackReceived: true, identityReceived: false, witnessReceived: true })
  assert.deepEqual(v, { observed: 'deny', reason: 'suback-0x80-denied' })
})

test('订阅：授予但未送达（即使见证者收到）→ 无法判定（不得报拒绝）', () => {
  const v = decideSubscribeVerdict({ subackDenied: false, subackReceived: true, identityReceived: false, witnessReceived: true })
  assert.equal(v.observed, 'unknown')
  assert.equal(v.reason, 'granted-no-delivery-no-denial-evidence')
  const v2 = decideSubscribeVerdict({ subackDenied: false, subackReceived: true, identityReceived: false, witnessReceived: false })
  assert.equal(v2.observed, 'unknown')
})

test('订阅：无 SUBACK（超时/静默）→ 无法判定', () => {
  const v = decideSubscribeVerdict({ subackDenied: false, subackReceived: false, identityReceived: false, witnessReceived: false })
  assert.deepEqual(v, { observed: 'unknown', reason: 'no-suback' })
})

test('订阅：连接层拒绝与发布侧一致地判无法判定（共用分类的契约）', () => {
  for (const code of [4, 5]) {
    const cls = classifyIdentityConnectFailure({ connackCode: code, message: `code ${code}` })
    const check = { id: 's', identity: 'u', action: 'subscribe', filter: 'f/#', expect: 'deny' }
    const combined = combineCheck(check, cls, decideSubscribeVerdict({ subackDenied: false, subackReceived: false, identityReceived: false, witnessReceived: false }))
    assert.equal(combined.sides.source.observed, 'unknown')
    assert.equal(combined.sides.source.requirement, 'unknown', 'CONNACK 拒绝不得当作"订阅被拒"通过')
    assert.equal(combined.expansion, false)
  }
})

test('固定案例 c3 新语义：源端未送达=unknown 不得汇总为权限扩大/通过/业务受损，目标端送达仍构成要求失败', () => {
  const check = { id: 'c3', identity: 'device-sensor', action: 'publish', topic: 'factory/admin/secret', expect: 'deny' }
  const source = decidePublishVerdict({ puback: true, delivered: false }) // 源端拒绝但无协议证据
  const target = decidePublishVerdict({ puback: true, delivered: true }) // 目标端实际送达
  const combined = combineCheck(check, source, target)
  assert.equal(combined.sides.source.observed, 'unknown')
  assert.equal(combined.sides.target.observed, 'allow')
  assert.equal(combined.expansion, false, '源端无明确拒绝证据，不得报权限扩大')
  assert.equal(combined.damage, false, '期望为 deny，不构成业务受损')
  assert.equal(combined.requirement, 'fail', '目标端正证据（送达）违反"必须拒绝"的业务要求')
})
