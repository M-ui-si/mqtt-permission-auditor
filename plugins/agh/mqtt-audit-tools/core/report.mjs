// 报告渲染：人读文本 + 机器可读 JSON 共用同一结果对象（core/runner.mjs 输出）。

const RESULT_TEXT = { pass: '通过', fail: '失败', unknown: '无法判定' }
const OBSERVED_TEXT = { allow: '允许', deny: '拒绝', unknown: '无法判定' }

export function renderHuman(result) {
  const lines = []
  const s = result.summary
  lines.push('MQTT Permission Auditor — 迁移验收报告')
  lines.push('='.repeat(46))
  lines.push(`案例集: ${result.caseSet.id} — ${result.caseSet.description}`)
  lines.push(`源端: ${result.brokers.source.label} (${result.brokers.source.endpoint})  健康: ${result.brokers.source.health.ok ? '正常' : `不可用（${result.brokers.source.health.detail}）`}`)
  lines.push(`目标端: ${result.brokers.target.label} (${result.brokers.target.endpoint})  健康: ${result.brokers.target.health.ok ? '正常' : `不可用（${result.brokers.target.health.detail}）`}`)
  lines.push(`生成时间: ${result.generatedAt}`)
  lines.push('')
  lines.push(`总体结论: ${RESULT_TEXT[s.overall]}`)
  lines.push('')
  lines.push('维度汇总')
  lines.push(`- 权限扩大（源端拒绝 → 目标端允许）: ${s.expansion.length ? `存在 ${s.expansion.length} 项` : '未发现'}`)
  for (const e of s.expansion) lines.push(`    * ${e.checkId} ${e.identity} ${e.action} ${e.topic}`)
  lines.push(`- 业务受损（业务必需但目标端拒绝）: ${s.damage.length ? `存在 ${s.damage.length} 项` : '未发现'}`)
  for (const d of s.damage) lines.push(`    * ${d.checkId} ${d.identity} ${d.action} ${d.topic}`)
  const reqTotal = s.total * 2
  const reqFail = s.requirementFailures.length
  const reqUnknown = s.unknowns.length
  lines.push(`- 业务要求符合性: 失败 ${reqFail} / 无法判定 ${reqUnknown} / 通过 ${reqTotal - reqFail - reqUnknown}（共 ${reqTotal} 项 = ${s.total} 检查 × 源/目标两端）`)
  lines.push('')
  lines.push('逐项检查')
  lines.push('| 检查 | 身份 | 动作 | 主题 | 期望 | 源端观测 | 目标观测 | 结论 |')
  lines.push('| --- | --- | --- | --- | --- | --- | --- | --- |')
  for (const c of result.checks) {
    const src = c.sides.source
    const tgt = c.sides.target
    lines.push(`| ${c.checkId} | ${c.identity} | ${c.action === 'publish' ? '发布' : '订阅'} | ${c.topic} | ${OBSERVED_TEXT[c.expect]} | ${OBSERVED_TEXT[src.observed]}${src.reason ? ` (${src.reason})` : ''} | ${OBSERVED_TEXT[tgt.observed]}${tgt.reason ? ` (${tgt.reason})` : ''} | ${RESULT_TEXT[c.requirement]}${c.expansion ? ' +权限扩大' : ''}${c.damage ? ' +业务受损' : ''} |`)
  }
  lines.push('')
  lines.push('独立业务要求')
  for (const r of result.caseSet.requirements) lines.push(`- ${r}`)
  lines.push('')
  lines.push('范围声明')
  lines.push('- 本报告仅覆盖上述案例集列出的身份、动作与主题组合，不证明全主题空间或全部身份上的权限等价。')
  lines.push('- 允许判定的主证据是见证订阅者实际收到消息；PUBACK/SUBACK 与客户端退出码仅作辅助证据。')
  lines.push('- 拒绝判定仅在存在主题级明确拒绝证据（SUBACK 0x80）时报出；CONNACK 4/5 属连接建立阶段拒绝，身份未能建立连接，不代表主题 ACL 拒绝，判"无法判定"；MQTT 3.1.1 下发布被拒无协议级证据，"收到 PUBACK 但未送达"一律判"无法判定"。以上均不计为拒绝、通过、权限扩大或业务受损。')
  lines.push('- "无法判定"涵盖连接失败、超时、协议异常与证据缺失，不代表拒绝或通过。')
  lines.push(`- Broker 版本与镜像摘要以 docs/environment-versions.md 固定记录为准；案例定义见 fixtures/cases/。`)
  for (const sc of result.scope) lines.push(`- ${sc}`)
  lines.push('')
  lines.push(`退出码: 0=全部通过 1=存在失败 2=仅存在无法判定`)
  return lines.join('\n')
}

export function renderJson(result) {
  return JSON.stringify(result, null, 2)
}
