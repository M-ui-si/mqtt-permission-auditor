import test from 'node:test'
import assert from 'node:assert/strict'
import { parseEndpoint } from '../../cli/run-audit.mjs'

test('CLI：唯一合法地址是数字回环 127.0.0.1', () => {
  assert.deepEqual(parseEndpoint('127.0.0.1:1883', '--source'), { host: '127.0.0.1', port: 1883 })
  assert.deepEqual(parseEndpoint('127.0.0.1:2883', '--target'), { host: '127.0.0.1', port: 2883 })
})

test('CLI：拒绝 localhost、域名、非回环 IP、0.0.0.0、IPv6 与畸形输入', () => {
  for (const bad of [
    'localhost:1883',
    '0.0.0.0:1883',
    '192.168.1.5:1883',
    '10.0.0.1:1883',
    '::1:1883',
    '[::1]:1883',
    'broker.example.com:1883',
    '127.0.0.2:1883',
    '127.0.0.1',
    '127.0.0.1:abc',
    undefined,
  ]) {
    assert.throws(() => parseEndpoint(bad, '--source'), /127\.0\.0\.1|HOST:PORT/, `${bad} 应被拒绝`)
  }
})

test('CLI：模块可被导入执行测试而不启动 main（本文件本身即证明）', () => {
  assert.equal(typeof parseEndpoint, 'function')
})
