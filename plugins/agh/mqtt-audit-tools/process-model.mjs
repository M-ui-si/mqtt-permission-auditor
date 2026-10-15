export const EVENT_LABELS = {
  'run.prepared': '运行已准备', 'run.started': '开始验收', 'run.completed': '报告已保存', 'run.failed': '运行未完成', 'run.interrupted': '运行中断',
  'check.started': '开始检查', 'check.ended': '检查结束', 'health.observed': '本轮连接观测',
  'connect.request': '正在连接', 'connect.result': '连接结果', 'subscribe.request': '订阅请求已发出', 'subscribe.ack': '订阅回执已收到',
  'publish.request': '发布请求已发出', 'publish.ack': '发布回执已收到', 'message.received': '消息已实际送达', 'message.timeout': '等待结束，未取得送达证据', 'protocol.incomplete': '协议证据不足', 'verdict': '确定性判定', 'jev.advice': 'Jev 建议（尚不代表采纳）', 'jev.unavailable': 'Jev 建议不可用',
}
export function eventLabel(event) {
  if (event.type === 'subscribe.ack' && event.grants?.includes(128)) return '订阅明确拒绝 · SUBACK 0x80'
  if (event.type === 'connect.result') return event.ok ? 'MQTT 连接已建立' : '连接未建立，主题权限未知'
  if (event.type === 'verdict') return { allow: '实际观测允许', deny: '协议明确拒绝', unknown: '无法判定' }[event.observed] ?? '无法判定'
  return EVENT_LABELS[event.type] ?? event.type
}
export function mergeEvents(previous, incoming, runId) {
  const map = new Map(previous.map(event => [event.seq, event]))
  let invalid = false
  for (const event of incoming) {
    if (event.runId !== runId || !Number.isSafeInteger(event.seq) || event.seq < 1) { invalid = true; continue }
    if (map.has(event.seq) && JSON.stringify(map.get(event.seq)) !== JSON.stringify(event)) { invalid = true; continue }
    map.set(event.seq, event)
  }
  const events = [...map.values()].sort((a,b) => a.seq - b.seq)
  return { events, incomplete: invalid || events.some((event, index) => event.seq !== index + 1) }
}
export function reduceProcess(events, count = events.length) {
  const state = { checks: {}, health: {}, currentCheck: null, completed: 0, phase: '等待过程记录', advice: [] }
  for (const event of events.slice(0, count)) {
    state.phase = eventLabel(event)
    if (event.type === 'health.observed') state.health[event.side] = event.ok
    if (event.type.startsWith('jev.')) state.advice.push(event)
    if (!event.checkId) continue
    const check = state.checks[event.checkId] ??= { checkId: event.checkId, sides: { source: { roles: {}, events: [] }, target: { roles: {}, events: [] } } }
    state.currentCheck = event.checkId
    if (event.type === 'check.started') Object.assign(check, { identity: event.identity, topic: event.topic, action: event.action })
    if (event.type === 'check.ended') { check.requirement = event.requirement; state.completed++ }
    if (event.side && check.sides[event.side]) {
      const side = check.sides[event.side]
      side.events.push(event)
      if (event.role) {
        const role = side.roles[event.role] ??= {}
        role.latest = event
        if (event.type === 'message.received') role.received = true
        if (event.type === 'subscribe.ack' && event.grants?.includes(128)) role.denied = true
        if (event.type === 'connect.result') role.connected = event.ok
        if (event.type === 'publish.ack') role.puback = true
      }
      if (event.type === 'verdict') side.observed = event.observed
    }
  }
  return state
}
export function buildAuditPrompt({ parentRunId, checkIds = [] } = {}) {
  if (parentRunId && (!/^run-[A-Za-z0-9_-]{1,128}$/.test(parentRunId) || !checkIds.length || checkIds.some(id => !/^c[1-8]$/.test(id)))) throw new Error('invalid-retest')
  return parentRunId
    ? `使用 mqtt-migration-audit，对固定本地 migration-baseline / local-isolated 请求复测。先查看原运行 ${parentRunId} 的证据与环境变化，再用 mqtt_audit_prepare_run 携带 parentRunId=${parentRunId}、checkIds=${checkIds.join(',')} 准备复测，由你决定执行并解释理由。使用返回 runId 调用 mqtt_audit_run_check，复读结果并对比原运行。局部复测不代表全量通过；协议证据条件未变时不要反复重试。`
    : '使用 mqtt-migration-audit，验收固定本地 Mosquitto 到 EMQX 的权限迁移。发现案例后先调用 mqtt_audit_prepare_run（caseId=migration-baseline，instanceId=local-isolated）取得 runId，再使用该 runId 调用 mqtt_audit_run_check，完整覆盖 c1–c8，复读结果并解释权限扩大、业务受损、业务要求和无法判定项。Jev 如已启用可提出建议，最终行动由你决定。'
}
