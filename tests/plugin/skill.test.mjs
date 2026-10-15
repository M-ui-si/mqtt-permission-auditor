import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
test('AGH 插件包提供可审核的目标驱动 Skill，并约束证据与工具边界', () => {
  const manifest = JSON.parse(readFileSync('plugins/agh/mqtt-audit-tools/package.json', 'utf8'))
  const contribution = manifest.agnes.contributions.find((item) => item.kind === 'skill')
  assert.equal(contribution.id, 'mqtt-audit-tools/mqtt-migration-audit')
  assert.equal(contribution.path, './skills/mqtt-migration-audit.md')
  const body = readFileSync('plugins/agh/mqtt-audit-tools/skills/mqtt-migration-audit.md', 'utf8')
  assert.match(body, /^---\s+name: mqtt-migration-audit\s+description: .*goal.*\s+---/)
  for (const tool of ['mqtt_audit_list_cases', 'mqtt_audit_run_check', 'mqtt_audit_read_result']) {
    assert.ok(body.includes(tool), `${tool} must be in workflow`)
  }
  assert.match(body, /unknown.*unable to determine/i)
  assert.match(body, /Do not use arbitrary paths, hosts, credentials, shell commands, or external targets/)
  assert.match(body, /Never substitute a simulation/)
})
