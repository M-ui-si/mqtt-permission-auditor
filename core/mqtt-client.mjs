// 最小 MQTT 3.1.1 客户端（零第三方依赖）。
// 只实现迁移验收探针所需的子集：CONNECT/CONNACK、SUBSCRIBE/SUBACK、
// QoS1 PUBLISH/PUBACK、接收 QoS0/1 PUBLISH。不做重连、保持连接与遗嘱。
// 协议依据 MQTT Version 3.1.1 规范；实测对象为 Mosquitto 2.1.2 与 EMQX 6.3.1。

import net from 'node:net'

const CONNACK_TEXT = {
  0: 'accepted',
  1: 'unacceptable protocol version',
  2: 'identifier rejected',
  3: 'server unavailable',
  4: 'bad user name or password',
  5: 'not authorised',
}

function encodeRemainingLength(n) {
  const out = []
  do {
    let b = n % 128
    n = Math.floor(n / 128)
    if (n > 0) b |= 0x80
    out.push(b)
  } while (n > 0)
  return out
}

function encodeString(s) {
  const b = Buffer.from(String(s), 'utf8')
  if (b.length > 0xffff) throw new Error('string too long for MQTT length prefix')
  return Buffer.concat([Buffer.from([b.length >> 8, b.length & 0xff]), b])
}

function buildPacket(firstByte, body) {
  return Buffer.concat([Buffer.from([firstByte, ...encodeRemainingLength(body.length)]), body])
}

function buildConnect({ clientId, username, password, keepaliveSec = 30 }) {
  let flags = 0x02 // clean session
  if (username !== undefined) flags |= 0x80
  if (password !== undefined) flags |= 0x40
  const variableHeader = Buffer.concat([
    encodeString('MQTT'),
    Buffer.from([4, flags, (keepaliveSec >> 8) & 0xff, keepaliveSec & 0xff]),
  ])
  const payload = [encodeString(clientId)]
  if (username !== undefined) payload.push(encodeString(username))
  if (password !== undefined) payload.push(encodeString(password))
  return buildPacket(0x10, Buffer.concat([variableHeader, ...payload]))
}

// 解析单个报文；buf 不足一个完整报文时返回 null。
export function parsePacket(buf) {
  if (buf.length < 2) return null
  const first = buf[0]
  let multiplier = 1
  let value = 0
  let i = 1
  let byte
  do {
    if (i >= buf.length) return null
    byte = buf[i++]
    value += (byte & 0x7f) * multiplier
    multiplier *= 128
    if (multiplier > 128 * 128 * 128 * 2) throw new Error('malformed remaining length')
  } while (byte & 0x80)
  if (buf.length < i + value) return null
  return { type: first >> 4, flags: first & 0x0f, body: buf.subarray(i, i + value), consumed: i + value }
}

export function decodeConnack(body) {
  if (body.length < 2) throw new Error('short CONNACK')
  const code = body[1]
  return { code, text: CONNACK_TEXT[code] ?? `unknown(${code})` }
}

export function decodeSuback(body) {
  if (body.length < 3) throw new Error('short SUBACK')
  const packetId = (body[0] << 8) | body[1]
  const grants = [...body.subarray(2)]
  return { packetId, grants }
}

export function decodePublish(flags, body) {
  if (body.length < 2) throw new Error('short PUBLISH')
  const topicLen = (body[0] << 8) | body[1]
  let offset = 2 + topicLen
  if (offset > body.length) throw new Error('PUBLISH topic overruns packet')
  const qos = (flags >> 1) & 0x03
  let packetId = null
  if (qos > 0) {
    if (offset + 2 > body.length) throw new Error('short PUBLISH packet id')
    packetId = (body[offset] << 8) | body[offset + 1]
    offset += 2
  }
  return {
    topic: body.subarray(2, 2 + topicLen).toString('utf8'),
    payload: body.subarray(offset).toString('utf8'),
    qos,
    packetId,
  }
}

function withTimeout(promise, ms, label) {
  let timer
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(`${label} timeout after ${ms}ms`)), ms)
  })
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer))
}

export class MqttClient {
  constructor(socket) {
    this.socket = socket
    this.connack = null
    this.buffer = Buffer.alloc(0)
    this.incoming = []
    this.messageWaiters = []
    this.connackWaiter = null
    this.subackWaiter = null
    this.pubackWaiter = null
    socket.on('data', (chunk) => this.#onData(chunk))
    socket.on('close', () => this.#failWaiters(new Error('connection closed')))
    socket.on('error', (err) => this.#failWaiters(err))
  }

  #failWaiters(err) {
    const waiters = [this.connackWaiter, this.subackWaiter, this.pubackWaiter, ...this.messageWaiters]
    this.connackWaiter = this.subackWaiter = this.pubackWaiter = null
    this.messageWaiters = []
    for (const w of waiters) if (w) w.reject(err)
  }

  #onData(chunk) {
    this.buffer = Buffer.concat([this.buffer, chunk])
    for (;;) {
      let pkt
      try {
        pkt = parsePacket(this.buffer)
      } catch (err) {
        this.#failWaiters(err)
        this.socket.destroy()
        return
      }
      if (!pkt) return
      this.buffer = this.buffer.subarray(pkt.consumed)
      this.#dispatch(pkt)
    }
  }

  #dispatch(pkt) {
    if (pkt.type === 2) {
      // CONNACK
      const w = this.connackWaiter
      this.connackWaiter = null
      if (w) w.resolve(decodeConnack(pkt.body))
    } else if (pkt.type === 3) {
      // PUBLISH（下行）
      const msg = decodePublish(pkt.flags, pkt.body)
      if (msg.qos > 0 && msg.packetId !== null) {
        // 对下行 QoS1 消息回 PUBACK，避免对端重发干扰探针。
        const ack = buildPacket(0x40, Buffer.from([msg.packetId >> 8, msg.packetId & 0xff]))
        this.socket.write(ack)
      }
      const waiter = this.messageWaiters.shift()
      if (waiter) waiter.resolve(msg)
      else this.incoming.push(msg)
    } else if (pkt.type === 9) {
      // SUBACK
      const w = this.subackWaiter
      this.subackWaiter = null
      if (w) w.resolve(decodeSuback(pkt.body))
    } else if (pkt.type === 4) {
      // PUBACK
      const w = this.pubackWaiter
      this.pubackWaiter = null
      if (w) w.resolve(true)
    }
    // PINGRESP 等忽略；探针生命周期短于保活时限。
  }

  waitForMessage(timeoutMs, label = 'message') {
    if (this.incoming.length > 0) return Promise.resolve(this.incoming.shift())
    return withTimeout(
      new Promise((resolve, reject) => this.messageWaiters.push({ resolve, reject })),
      timeoutMs,
      label,
    )
  }

  subscribe(filter, timeoutMs = 4000) {
    const packetId = 1
    const body = Buffer.concat([
      Buffer.from([0, packetId]),
      encodeString(filter),
      Buffer.from([0x00]), // 请求 QoS0：下行无需确认，简化证据链
    ])
    const wait = new Promise((resolve, reject) => {
      this.subackWaiter = { resolve, reject }
    })
    this.socket.write(buildPacket(0x82, body))
    return withTimeout(wait, timeoutMs, 'SUBACK')
  }

  publish(topic, payload, timeoutMs = 4000) {
    const packetId = 1
    const body = Buffer.concat([encodeString(topic), Buffer.from([0, packetId]), Buffer.from(String(payload), 'utf8')])
    const wait = new Promise((resolve, reject) => {
      this.pubackWaiter = { resolve, reject }
    })
    this.socket.write(buildPacket(0x32, body)) // PUBLISH, QoS1
    return withTimeout(wait, timeoutMs, 'PUBACK')
  }

  close() {
    this.socket.destroy()
  }

  static async connect({ host, port, username, password, clientId, timeoutMs = 4000, signal }) {
    signal?.throwIfAborted()
    const socket = net.connect({ host, port })
    const abort = () => socket.destroy(new Error('operation aborted'))
    signal?.addEventListener('abort', abort, { once: true })
    socket.once('close', () => signal?.removeEventListener('abort', abort))
    const client = new MqttClient(socket)
    const connack = new Promise((resolve, reject) => {
      client.connackWaiter = { resolve, reject }
    })
    // TCP 连接失败时 connack 尚未被 await，先挂空捕获避免未处理拒绝导致进程崩溃。
    connack.catch(() => {})
    const connected = new Promise((resolve, reject) => {
      socket.once('connect', () => resolve())
      socket.once('error', reject)
    })
    try {
      await withTimeout(connected, timeoutMs, 'TCP connect')
      socket.write(buildConnect({ clientId, username, password }))
      const result = await withTimeout(connack, timeoutMs, 'CONNACK')
      if (result.code !== 0) {
        const err = new Error(`CONNACK refused: ${result.text} (code ${result.code})`)
        err.connackCode = result.code
        throw err
      }
      client.connack = result
      return client
    } catch (err) {
      client.#failWaiters(err)
      client.close()
      throw err
    }
  }
}
