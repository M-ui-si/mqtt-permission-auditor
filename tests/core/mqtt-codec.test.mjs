import test from 'node:test'
import assert from 'node:assert/strict'
import { parsePacket, decodeConnack, decodeSuback, decodePublish } from '../../core/mqtt-client.mjs'

test('parsePacket 解析单字节剩余长度的完整报文', () => {
  const buf = Buffer.from([0x20, 2, 0, 0]) // CONNACK accepted
  const pkt = parsePacket(buf)
  assert.equal(pkt.type, 2)
  assert.equal(pkt.consumed, 4)
})

test('parsePacket 两字节剩余长度（>127）', () => {
  const body = Buffer.alloc(200, 0x61)
  const buf = Buffer.concat([Buffer.from([0x30, 0xc8, 0x01]), body])
  const pkt = parsePacket(buf)
  assert.equal(pkt.type, 3)
  assert.equal(pkt.body.length, 200)
  assert.equal(pkt.consumed, 203)
})

test('parsePacket 数据不足时返回 null 而不是抛错', () => {
  assert.equal(parsePacket(Buffer.from([0x20])), null)
  assert.equal(parsePacket(Buffer.from([0x20, 5, 0])), null)
})

test('decodeConnack 返回码与文案', () => {
  assert.deepEqual(decodeConnack(Buffer.from([0, 0])), { code: 0, text: 'accepted' })
  assert.equal(decodeConnack(Buffer.from([0, 5])).text, 'not authorised')
})

test('decodeSuback 解析授予列表（含 0x80 拒绝）', () => {
  const sub = decodeSuback(Buffer.from([0, 1, 1, 0x80]))
  assert.equal(sub.packetId, 1)
  assert.deepEqual(sub.grants, [1, 0x80])
})

test('decodePublish QoS0 与 QoS1', () => {
  const topic = Buffer.from([0, 3, 97, 47, 98]) // "a/b"
  const qos0 = decodePublish(0x30, Buffer.concat([topic, Buffer.from('hi')]))
  assert.equal(qos0.topic, 'a/b')
  assert.equal(qos0.payload, 'hi')
  assert.equal(qos0.qos, 0)
  const qos1 = decodePublish(0x32, Buffer.concat([topic, Buffer.from([0, 9]), Buffer.from('hi')]))
  assert.equal(qos1.qos, 1)
  assert.equal(qos1.packetId, 9)
  assert.equal(qos1.payload, 'hi')
})

test('decodePublish 非法长度前缀抛错', () => {
  assert.throws(() => decodePublish(0x30, Buffer.from([0, 9, 97])), /overrun|short/)
})
