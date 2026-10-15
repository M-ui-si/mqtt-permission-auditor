import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'

// 插件包自包含副本必须与仓库实现逐字节一致，防止快照漂移。
const pairs = [
  ['core/mqtt-client.mjs', 'plugins/agh/mqtt-audit-tools/core/mqtt-client.mjs'],
  ['core/prober.mjs', 'plugins/agh/mqtt-audit-tools/core/prober.mjs'],
  ['core/runner.mjs', 'plugins/agh/mqtt-audit-tools/core/runner.mjs'],
  ['core/report.mjs', 'plugins/agh/mqtt-audit-tools/core/report.mjs'],
  ['fixtures/cases/migration-baseline.json', 'plugins/agh/mqtt-audit-tools/fixtures/cases/migration-baseline.json'],
]

test('插件内嵌 core 与 fixtures 副本与源实现一致', () => {
  for (const [src, copy] of pairs) {
    assert.equal(
      readFileSync(path.resolve(src), 'utf8'),
      readFileSync(path.resolve(copy), 'utf8'),
      `${copy} 与 ${src} 不一致：修改 core 后需同步插件副本`,
    )
  }
})

test('实例注册表仅含固定本地实例', () => {
  const instances = JSON.parse(readFileSync(path.resolve('plugins/agh/mqtt-audit-tools/instances.json'), 'utf8'))
  assert.deepEqual(Object.keys(instances), ['local-isolated'])
  assert.equal(instances['local-isolated'].source.host, '127.0.0.1')
  assert.equal(instances['local-isolated'].source.port, 11883)
  assert.equal(instances['local-isolated'].target.port, 2883)
})
