// Current-session projection only; never fall back to a global latest report.
export const AUDIT_TOOL_LABELS = {
  mqtt_audit_list_cases: '发现案例',
  mqtt_audit_run_check: '执行验收',
  mqtt_audit_read_result: '复读结果',
  mqtt_audit_prepare_run: '准备运行',
  mqtt_audit_plan_next: 'Jev 建议',
}
const runIdFrom = text => /"runId"\s*:\s*"(run-[A-Za-z0-9_-]{1,128})"/.exec(text ?? '')?.[1]
export async function readProcessSession({ sessionId, readProjection }) {
  if (!sessionId) return { status: 'empty', runs: [], actions: [], busy: true, message: '请先选择 AGH 会话。' }
  const projection = await readProjection()
  if (projection?.status !== 'available') return { status: 'unavailable', runs: [], actions: [], busy: true, message: '会话轨迹暂不可读。' }
  const timeline = projection.value?.timeline ?? projection.value
  if (timeline?.sessionId && timeline.sessionId !== sessionId) return { status: 'unavailable', runs: [], actions: [], busy: true, message: '正在切换会话。' }
  const nodes = Array.isArray(timeline?.nodes) ? timeline.nodes : []
  const tools = nodes.filter(node => node.kind === 'tool' && Object.hasOwn(AUDIT_TOOL_LABELS, node.name))
  const runs = []
  for (const node of tools) {
    if (!['mqtt_audit_prepare_run', 'mqtt_audit_run_check'].includes(node.name)) continue
    const id = runIdFrom(node.resultPreview) ?? runIdFrom(node.argsPreview)
    if (id && !runs.includes(id)) runs.push(id)
  }
  return { status: 'ok', runs, busy: Boolean(timeline?.opState) || timeline?.turns?.some(turn => ['running','waiting'].includes(turn.status)) || nodes.some(node => ['running','planned','awaiting_approval'].includes(node.status)),
    actions: tools.map(node => ({ name: node.name, status: node.status, seq: node.seq, runId: runIdFrom(node.resultPreview) ?? runIdFrom(node.argsPreview) })) }
}
export async function readSessionDashboard({ sessionId, readProjection, callLatest }) {
  if (!sessionId) return { status: 'empty', activity: [] }
  const projection = await readProjection()
  if (projection?.status !== 'available') return { status: 'unavailable', activity: [], message: '当前会话轨迹暂不可读，请刷新重试。' }
  const timeline = projection.value
  const nodes = Array.isArray(timeline?.nodes) ? timeline.nodes : Array.isArray(timeline?.timeline?.nodes) ? timeline.timeline.nodes : []
  const tools = nodes.filter((node) => node?.kind === 'tool' && Object.hasOwn(AUDIT_TOOL_LABELS, node.name))
  const activity = tools.map(({ name, status, seq }) => ({ name, status, seq }))
  const call = tools.findLast((node) => node.name === 'mqtt_audit_run_check')
  if (!call) return { status: 'empty', activity }
  if (['running', 'planned', 'awaiting_approval'].includes(call.status)) return { status: 'running', activity }
  if (['failed', 'cancelled'].includes(call.status)) return { status: 'error', activity, message: '本次验收工具未完成，请查看对话中的工具反馈。' }
  const runId = /"runId"\s*:\s*"(run-[A-Za-z0-9_-]{1,128})"/.exec(call.resultPreview ?? '')?.[1]
  if (!runId) return { status: 'error', activity, message: '本次工具结果缺少有效运行标识，请查看工具反馈。' }
  try {
    const response = await callLatest(runId)
    return response && typeof response === 'object' ? { ...response, activity } : { status: 'error', activity, message: '报告服务返回了无效数据。' }
  } catch {
    return { status: 'error', activity, message: '无法读取本次报告，请确认报告服务可用后重试。' }
  }
}
