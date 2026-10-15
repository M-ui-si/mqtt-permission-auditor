// 送达见证探针：以"消息实际送达"为允许的主证据。
// 主题级拒绝的唯一明确协议证据是 SUBACK 0x80（订阅）。
// CONNACK 4/5 是连接建立阶段拒绝：身份未能建立 MQTT 连接，不证明任何主题的
// 发布/订阅被 ACL 拒绝，因此与"收到 PUBACK 但未送达"一样判"无法判定"。
// 不引入未经验证的 MQTT 5 判定路径。

import { MqttClient } from './mqtt-client.mjs'

export const DEFAULT_TIMEOUTS = { connect: 4000, ack: 4000, delivery: 5000 }

export const NO_DENIAL_EVIDENCE_NOTE =
  '主题级拒绝证据目前仅有 SUBACK 0x80；连接建立阶段拒绝（CONNACK 4/5）与"收到 PUBACK 但未送达"均按规范判为无法判定，不计为拒绝、通过、权限扩大或业务受损；MQTT 5 reason code 候选路径待真实 Broker 环境验证后评估'

// 纯判决函数：供探针与单元测试共用，不接触网络。
export function decidePublishVerdict({ puback, delivered, failureReason }) {
  if (delivered) return { observed: 'allow', reason: 'witness-received-message' }
  if (puback === true) {
    return {
      observed: 'unknown',
      reason: 'puback-without-delivery-no-denial-evidence',
      limitation: NO_DENIAL_EVIDENCE_NOTE,
    }
  }
  return { observed: 'unknown', reason: failureReason ?? 'no-puback-and-no-delivery' }
}

export function decideSubscribeVerdict({
  subackDenied,
  subackReceived,
  identityReceived,
  witnessReceived,
}) {
  if (identityReceived) return { observed: 'allow', reason: 'subscriber-received-message' }
  if (subackDenied) return { observed: 'deny', reason: 'suback-0x80-denied' }
  if (witnessReceived) {
    return {
      observed: 'unknown',
      reason: 'granted-no-delivery-no-denial-evidence',
      limitation: NO_DENIAL_EVIDENCE_NOTE,
    }
  }
  if (subackReceived) return { observed: 'unknown', reason: 'granted-no-delivery-anywhere' }
  return { observed: 'unknown', reason: 'no-suback' }
}

// 身份连接失败（含 CONNACK 4/5 连接建立阶段拒绝）对发布与订阅一律"无法判定"：
// 连接未建立不证明任何主题操作被 ACL 拒绝。发布与订阅探针共用本分类。
export function classifyIdentityConnectFailure(err) {
  const extra = err?.connackCode !== undefined ? { connackCode: err.connackCode } : {}
  const detail =
    err?.connackCode !== undefined
      ? ` (CONNACK code ${err.connackCode}: ${err.message})`
      : `: ${err?.message ?? String(err)}`
  return { observed: 'unknown', reason: `identity-connect-failed${detail}`, evidence: extra }
}

function clientOptions(broker, identity, password) {
  return {
    host: broker.host,
    port: broker.port,
    username: identity,
    password,
    clientId: `mqttaudit-${identity}-${Math.random().toString(16).slice(2, 10)}`,
  }
}

async function tryConnect(opts, timeoutMs, emit = () => {}, role = 'identity', signal) {
  emit({ type: 'connect.request', role, identity: opts.username })
  try {
    const client = await MqttClient.connect({ ...opts, timeoutMs, signal })
    emit({ type: 'connect.result', role, identity: opts.username, ok: true, code: 0 })
    for (const [method, request, response] of [['subscribe','subscribe.request','subscribe.ack'], ['publish','publish.request','publish.ack']]) {
      const original = client[method].bind(client)
      client[method] = async (...args) => {
        emit({ type: request, role, identity: opts.username, topic: args[0] })
        try {
          const result = await original(...args)
          emit({ type: response, role, identity: opts.username, topic: args[0], ok: true, ...(method === 'subscribe' ? { grants: result.grants } : {}) })
          return result
        } catch (error) {
          emit({ type: 'protocol.incomplete', role, topic: args[0], action: method, ok: false })
          throw error
        }
      }
    }
    return { ok: true, client }
  } catch (err) {
    emit({ type: 'connect.result', role, identity: opts.username, ok: false, ...(err.connackCode !== undefined ? { code: err.connackCode } : {}) })
    return { ok: false, err }
  }
}

// 在窗口内等待载荷精确匹配 tag 的下行消息；返回 {matched, seen}。
async function awaitTag(client, tag, timeoutMs, emit = () => {}, role = 'witness') {
  const deadline = Date.now() + timeoutMs
  const seen = []
  for (;;) {
    const remaining = deadline - Date.now()
    if (remaining <= 0) break
    let msg
    try {
      msg = await client.waitForMessage(remaining)
    } catch {
      break // 连接关闭或超时
    }
    seen.push({ topic: msg.topic, payload: msg.payload })
    if (msg.payload === tag) {
      emit({ type: 'message.received', role, topic: msg.topic })
      return { matched: true, seen }
    }
  }
  emit({ type: 'message.timeout', role })
  return { matched: false, seen }
}

export async function probePublish({ broker, identity, password, witness, witnessPassword, topic, tag, timeouts = {}, onEvent = () => {}, signal }) {
  const t = { ...DEFAULT_TIMEOUTS, ...timeouts }
  const evidence = {}
  const unk = (reason) => ({ observed: 'unknown', reason, evidence })
  let witnessClient = null
  let identityClient = null
  try {
    const w = await tryConnect(clientOptions(broker, witness, witnessPassword), t.connect, onEvent, 'witness', signal)
    if (!w.ok) return unk(`witness-connect-failed: ${w.err.message}`)
    witnessClient = w.client
    try {
      await witnessClient.subscribe(topic, t.ack)
    } catch (err) {
      return unk(`witness-subscribe-failed: ${err.message}`)
    }
    evidence.witnessSubscribed = true

    const c = await tryConnect(clientOptions(broker, identity, password), t.connect, onEvent, 'identity', signal)
    if (!c.ok) {
      const cls = classifyIdentityConnectFailure(c.err)
      return { observed: cls.observed, reason: cls.reason, evidence: { ...evidence, ...cls.evidence } }
    }
    identityClient = c.client
    evidence.identityConnected = true

    let puback = false
    try {
      await identityClient.publish(topic, tag, t.ack)
      puback = true
    } catch (err) {
      evidence.pubackError = err.message
    }
    evidence.puback = puback

    const recv = await awaitTag(witnessClient, tag, t.delivery, onEvent, 'witness')
    evidence.witnessReceived = recv.matched
    const verdict = decidePublishVerdict({
      puback,
      delivered: recv.matched,
      failureReason: evidence.pubackError ? `puback-error:${evidence.pubackError}` : undefined,
    })
    if (verdict.limitation) evidence.limitation = verdict.limitation
    return { observed: verdict.observed, reason: verdict.reason, evidence }
  } finally {
    witnessClient?.close()
    identityClient?.close()
  }
}

export async function probeSubscribe({ broker, identity, password, publisher, publisherPassword, witness, witnessPassword, filter, publishTopic, tag, timeouts = {}, onEvent = () => {}, signal }) {
  const t = { ...DEFAULT_TIMEOUTS, ...timeouts }
  const evidence = {}
  const unk = (reason) => ({ observed: 'unknown', reason, evidence })
  let witnessClient = null
  let identityClient = null
  let publisherClient = null
  try {
    // 见证者订阅发布主题：用于把"订阅者未收到"归因到订阅侧还是发布侧。
    const w = await tryConnect(clientOptions(broker, witness, witnessPassword), t.connect, onEvent, 'witness', signal)
    if (!w.ok) return unk(`witness-connect-failed: ${w.err.message}`)
    witnessClient = w.client
    try {
      await witnessClient.subscribe(publishTopic, t.ack)
    } catch (err) {
      return unk(`witness-subscribe-failed: ${err.message}`)
    }

    const c = await tryConnect(clientOptions(broker, identity, password), t.connect, onEvent, 'identity', signal)
    if (!c.ok) {
      const cls = classifyIdentityConnectFailure(c.err)
      return { observed: cls.observed, reason: cls.reason, evidence: { ...evidence, ...cls.evidence } }
    }
    identityClient = c.client
    evidence.identityConnected = true

    let suback = null
    try {
      suback = await identityClient.subscribe(filter, t.ack)
      evidence.subackGrants = suback.grants
    } catch (err) {
      evidence.subackError = err.message // 无 SUBACK 属于无明确拒绝证据，见判决函数
    }
    if (suback && suback.grants.some((g) => g === 0x80)) {
      return { observed: 'deny', reason: 'suback-0x80-denied', evidence }
    }

    const p = await tryConnect(clientOptions(broker, publisher, publisherPassword), t.connect, onEvent, 'publisher', signal)
    if (!p.ok) return unk(`publisher-connect-failed: ${p.err.message}`)
    publisherClient = p.client
    try {
      await publisherClient.publish(publishTopic, tag, t.ack)
      evidence.publisherPuback = true
    } catch (err) {
      evidence.publisherPuback = false
      evidence.publisherPubackError = err.message
    }

    const [identityRecv, witnessRecv] = await Promise.all([
      awaitTag(identityClient, tag, t.delivery, onEvent, 'identity'),
      awaitTag(witnessClient, tag, t.delivery, onEvent, 'witness'),
    ])
    evidence.identityReceived = identityRecv.matched
    evidence.witnessReceived = witnessRecv.matched
    const verdict = decideSubscribeVerdict({
      subackDenied: false,
      subackReceived: suback !== null,
      identityReceived: identityRecv.matched,
      witnessReceived: witnessRecv.matched,
    })
    if (verdict.limitation) evidence.limitation = verdict.limitation
    return { observed: verdict.observed, reason: verdict.reason, evidence }
  } finally {
    witnessClient?.close()
    identityClient?.close()
    publisherClient?.close()
  }
}
