import { createElement as h, useEffect, useMemo, useRef, useState } from 'react'
import { readProcessSession, AUDIT_TOOL_LABELS } from '../../../dashboard-session.mjs'
import { mergeEvents, reduceProcess, eventLabel, buildAuditPrompt } from '../../../process-model.mjs'

const CHECKS = ['c1','c2','c3','c4','c5','c6','c7','c8']
const resultName = value => ({ pass: '符合要求', fail: '不符合要求', unknown: '无法判定' }[value] ?? '未完成')
const time = value => value ? new Date(value).toLocaleTimeString('zh-CN', { hour12: false }) : '暂无采样'
function Topology({ side, check, healthy, selected, select }) {
  const state = check?.sides[side] ?? { roles: {}, events: [] }
  const subscribe = check?.action === 'subscribe'
  const nodes = subscribe
    ? [['publisher', '合成发布者', 90, 48], ['broker', side === 'source' ? 'Mosquitto' : 'EMQX', 190, 170], ['identity', check.identity ?? '测试订阅者', 85, 290], ['witness','送达见证者',295,290]]
    : [['identity',check?.identity ?? '测试发布者',190,48], ['broker',side === 'source' ? 'Mosquitto' : 'EMQX',190,170], ['witness','送达见证者',190,290]]
  const edges = subscribe ? [['publisher','broker'],['broker','identity'],['broker','witness']] : [['identity','broker'],['broker','witness']]
  return h('article', { className: 'mpa-topology' },
    h('h3', null, side === 'source' ? '迁移前 · Mosquitto' : '迁移后 · EMQX'),
    h('p', { className: 'mpa-view-note' }, '独立测试 · ', healthy === true ? '本轮连接成功' : healthy === false ? '本轮连接未建立' : '本轮连接尚无观测'),
    h('svg', { viewBox: '0 0 380 345', role: 'group', 'aria-label': `${side === 'source' ? '源端' : '目标端'}消息路径` },
      h('defs', null, h('marker', { id: `mpa-arrow-${side}`, viewBox: '0 0 10 10', refX: 8, refY: 5, markerWidth: 5, markerHeight: 5, orient: 'auto-start-reverse' }, h('path', { d: 'M0 0 L10 5 L0 10z', fill: 'currentColor' }))),
      ...edges.map(([from,to]) => {
        const a = nodes.find(n => n[0] === from), b = nodes.find(n => n[0] === to)
        const received = from === 'broker' && state.roles[to]?.received
        const requested = to === 'broker' && state.events.some(e => e.type === 'publish.request' && e.role === from) && !state.events.some(e => e.type === 'publish.ack' && e.role === from)
        const acknowledged = to === 'broker' && state.events.some(e => e.type === 'publish.ack' && e.role === from)
        return h('g', { key: from+to },
          h('path', { className: `mpa-flow-path ${received ? 'is-delivered' : requested ? 'is-requested' : ''}`, d: `M${a[2]} ${a[3]+28} L${b[2]} ${b[3]-28}`, markerEnd: `url(#mpa-arrow-${side})` }),
          h('text', { x: (a[2]+b[2])/2+8, y: (a[3]+b[3])/2, className: 'mpa-flow-label' }, received ? '✓ 实际送达' : requested ? '↑ 发布请求' : acknowledged ? '✓ 发布回执' : from === 'broker' ? '等待送达证据' : '待发布'),
        )
      }),
      subscribe ? h('g', null,
        h('path', { className: `mpa-flow-path ${state.events.some(e => e.type === 'subscribe.request' && e.role === 'identity') ? 'is-subscription' : ''}`, d: 'M58 265 Q0 182 146 160', markerEnd: `url(#mpa-arrow-${side})` }),
        h('text', { x: 4, y: 216, className: 'mpa-flow-label' }, state.events.some(e => e.type === 'subscribe.request' && e.role === 'identity') ? '↑ 订阅请求' : '订阅请求待发出'),
      ) : null,
      ...nodes.map(([role,label,x,y]) => {
        const observed = state.roles[role]
        const status = role === 'broker' ? (healthy === true ? '已连接' : healthy === false ? '连接失败' : '尚无观测') : observed?.denied ? '✕ SUBACK 0x80 拒绝' : observed?.received ? '✓ 已实际收到消息' : observed?.latest ? eventLabel(observed.latest) : '尚无观测'
        return h('g', { key: role, role: 'button', tabIndex: 0, 'aria-label': `${label}：${status}，查看证据`, className: `mpa-flow-node ${selected === `${side}:${role}` ? 'is-selected' : ''} ${observed?.received ? 'is-delivered' : observed?.denied ? 'is-denied' : ''}`, onClick: () => select(`${side}:${role}`), onKeyDown: e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); select(`${side}:${role}`) } } },
          h('rect', { x: x-78, y: y-28, width: 156, height: 56, rx: 12 }),
          h('text', { x, y: y-4, textAnchor: 'middle' }, label),
          h('text', { x, y: y+16, textAnchor: 'middle', className: 'mpa-node-status' }, status),
        )
      }),
    ),
    h('p', { className: 'mpa-flow-topic' }, check?.topic ?? '等待选择检查项'),
    h('p', null, '权限观测：', { allow: '允许（实际送达）', deny: '拒绝（协议证据）', unknown: '无法判定' }[state.observed] ?? '进行中 / 尚未观测'),
  )
}

export function ProcessDashboard({ sessionId, readProjection, subscribeProjection, callService, submitPrompt }) {
  const [session, setSession] = useState({ runs: [], actions: [], busy: true })
  const [chosen, setChosen] = useState('')
  const runId = session.runs.includes(chosen) ? chosen : session.runs.at(-1)
  const [data, setData] = useState({ events: [], run: null, incomplete: false })
  const [health, setHealth] = useState({ sides: {}, stale: true })
  const [report, setReport] = useState(null), [parent, setParent] = useState(null)
  const [live, setLive] = useState(true), [playing, setPlaying] = useState(false), [cursor, setCursor] = useState(0), [speed, setSpeed] = useState(1)
  const [selected, setSelected] = useState(null), [checkId, setCheckId] = useState('')
  const [retests, setRetests] = useState([]), [sending, setSending] = useState(false), [message, setMessage] = useState('')
  const sendingRef = useRef(false)
  useEffect(() => {
    let alive = true, loading = false, repeat = false
    const load = async () => {
      if (loading) { repeat = true; return }
      loading = true
      try {
        const next = await readProcessSession({ sessionId, readProjection })
        if (alive) setSession(next)
      } catch { if (alive) setSession({ runs: [], actions: [], busy: true, message: '会话轨迹不可读。' }) }
      finally { loading = false; if (repeat && alive) { repeat = false; void load() } }
    }
    void load()
    const off = subscribeProjection(load), timer = setInterval(load, 1000)
    return () => { alive = false; off?.(); clearInterval(timer) }
  }, [sessionId, readProjection, subscribeProjection])
  useEffect(() => {
    let alive = true, loading = false
    const load = async () => {
      if (loading) return
      loading = true
      try { const next = await callService('mqtt.audit.health', {}); if (alive && next.status === 'ok') setHealth(next) }
      catch { if (alive) setHealth(old => ({ ...old, stale: true })) }
      finally { loading = false }
    }
    void load(); const timer = setInterval(load, 10000)
    return () => { alive = false; clearInterval(timer) }
  }, [callService])
  useEffect(() => {
    let alive = true, loading = false, events = [], incomplete = false
    setData({ events: [], run: null, incomplete: false }); setReport(null); setParent(null); setCursor(0); setLive(true); setPlaying(false); setCheckId(''); setSelected(null)
    if (!runId) return () => { alive = false }
    const load = async () => {
      if (loading) return
      loading = true
      try {
        for (;;) {
          const [state, batch] = await Promise.all([callService('mqtt.audit.runstatus', { runId }), callService('mqtt.audit.events', { runId, afterSeq: events.at(-1)?.seq ?? 0, limit: 200 })])
          if (!alive) return
          const before = events.length
          // Recomputed every poll: a transiently truncated or lagging batch must not
          // latch the observation warning once the merged journal is contiguous again.
          if (batch.status === 'ok') {
            const merged = mergeEvents(events, batch.events, runId)
            events = merged.events; incomplete = merged.incomplete || batch.incomplete
          } else if (batch.status !== 'empty') incomplete = true
          setData({ events: [...events], run: state.run ?? null, incomplete, unavailable: state.status === 'error' })
          if (state.run?.status === 'completed' || state.status === 'empty') {
            const final = await callService('mqtt.audit.latestresult', { runId })
            if (alive && final.status === 'ok') setReport(final.result)
          }
          if (batch.status !== 'ok' || !batch.hasMore || events.length === before) return
        }
      } catch { if (alive) setData(old => ({ ...old, disconnected: true })) }
      finally { loading = false }
    }
    void load(); const timer = setInterval(load, 1000)
    return () => { alive = false; clearInterval(timer) }
  }, [runId, callService])
  useEffect(() => {
    let alive = true
    setParent(null)
    const parentId = report?.parentRunId
    if (parentId && session.runs.includes(parentId)) callService('mqtt.audit.latestresult', { runId: parentId }).then(value => { if (alive && value.status === 'ok') setParent(value.result) }).catch(() => {})
    return () => { alive = false }
  }, [report?.parentRunId, session.runs.join(','), callService])
  const events = data.events
  const count = live ? events.length : Math.min(cursor, events.length)
  const frame = useMemo(() => reduceProcess(events, count), [events, count])
  const current = frame.checks[checkId || frame.currentCheck]
  useEffect(() => {
    if (live || !playing || cursor >= events.length) { if (playing && cursor >= events.length) setPlaying(false); return }
    const delay = Math.max(30, (Date.parse(events[cursor].time) - Date.parse(events[Math.max(0,cursor-1)].time)) / speed)
    const timer = setTimeout(() => setCursor(value => value+1), Math.min(delay, 2147483647))
    return () => clearTimeout(timer)
  }, [live, playing, cursor, speed, events])
  const seek = value => { setLive(false); setPlaying(false); setCursor(value) }
  const jump = kind => {
    const index = events.findIndex((e,i) => i >= count && (kind === 'anomaly' ? e.type === 'message.timeout' || e.type === 'protocol.incomplete' || e.grants?.includes(128) || e.observed === 'unknown' || e.requirement === 'fail' || e.ok === false : e.type === kind))
    if (index >= 0) seek(index+1)
    else setMessage('后续记录中没有该事件。')
  }
  const submit = async retest => {
    if (sendingRef.current || session.busy || !sessionId) return
    sendingRef.current = true; setSending(true); setMessage('正在提交到当前 AGH 会话…')
    try {
      const fresh = await readProcessSession({ sessionId, readProjection })
      if (fresh.busy || (retest && !fresh.runs.includes(runId))) throw new Error('busy')
      await submitPrompt(sessionId, buildAuditPrompt(retest ? { parentRunId: runId, checkIds: retests } : {}))
      setMessage('请求已进入 AGH 会话，等待 Agnes 规划。')
    } catch { setMessage('请求未提交：会话忙碌、已切换或服务暂不可用。') }
    finally { sendingRef.current = false; setSending(false) }
  }
  const selectedEvents = current ? ['source','target'].flatMap(side => current.sides[side].events.filter(e => !selected || selected === `${side}:${e.role}` || selected === `${side}:broker`)) : []
  const lastAdvice = frame.advice.at(-1)
  const healthStale = health.stale || !health.sampledAt || Date.now() - Date.parse(health.sampledAt) > 30000
  const healthStopped = health.monitoring === false
  return h('div', { className: 'mpa-dashboard mpa-process' },
    h('header', { className: 'mpa-header' }, h('h2', null, '验收过程'), h('span', { className: 'mpa-mode' }, health.mode ?? 'Agnes')),
    h('section', { className: 'mpa-live-health', 'aria-label': '实时健康监测' },
      h('strong', null, '● 实时健康 ', healthStopped ? '· 监测已停止' : healthStale ? '· 状态已过期 / 暂无采样' : ''),
      ...['source','target'].map(side => h('p', { key: side }, side === 'source' ? 'Mosquitto：' : 'EMQX：', !healthStale && health.sides?.[side]?.connection === 'connected' ? '连接成功' : !healthStale && health.sides?.[side]?.connection === 'unreachable' ? '不可达' : '未知', ' · 消息往返 ', !healthStale && health.sides?.[side]?.roundtrip === 'received' ? '已见证' : '无法判定')),
      h('small', null, '最近采样 ', time(health.sampledAt), ' · 独立监测，不计入审计结论'),
    ),
    h('div', { className: 'mpa-process-tools' },
      h('label', null, '运行 ', h('select', { 'aria-label': '选择会话运行', value: runId ?? '', onChange: e => setChosen(e.target.value) }, session.runs.length ? session.runs.map((id,i) => h('option', { key: id, value: id }, `${i+1}. ${id}`)) : h('option', { value: '' }, '暂无运行'))),
      h('button', { type: 'button', onClick: () => submit(false), disabled: !sessionId || session.busy || sending }, '发起验收'),
    ),
    session.message ? h('p', { role: 'status' }, session.message) : null,
    session.busy && sessionId ? h('p', { className: 'mpa-view-note' }, '会话忙碌中，等待当前任务结束后可提交新请求。') : null,
    data.incomplete || data.disconnected || data.unavailable || data.run?.status === 'interrupted' ? h('p', { role: 'alert', className: 'mpa-observation-warning' }, '观察不完整或运行中断。缺失事件不能补作成功路径。') : null,
    !events.length ? h('p', { role: 'status' }, report ? '无过程记录。该历史报告仍可在概览与对照页查看。' : runId ? '等待过程记录…' : '从当前会话发起一次验收，图中将展示真实交互。') : null,
    h('section', { className: 'mpa-run-progress' },
      h('strong', null, live ? '实时过程' : '历史回放'), ' · ', frame.phase,
      h('p', null, `当前检查 ${frame.currentCheck ?? '—'} · ${frame.completed}/${data.run?.checkIds?.length ?? 8} 项结束 · ${data.run?.status ?? '等待运行'}`),
      data.run?.scope === 'partial' ? h('p', null, '局部复测：', data.run.checkIds.join('、'), '，不代表全量验收通过。') : null,
      h('label', null, '图中检查 ', h('select', { value: checkId, onChange: e => { setCheckId(e.target.value); setSelected(null) } }, h('option', { value: '' }, '跟随当前检查'), ...Object.keys(frame.checks).map(id => h('option', { key: id, value: id }, id)))),
    ),
    h('div', { className: 'mpa-topology-pair' }, ...['source','target'].map(side => h(Topology, { key: side, side, check: current, healthy: frame.health[side], selected, select: setSelected }))),
    h('p', { className: 'mpa-view-note' }, '两端分别测试，没有 Broker 间消息转发。回执 ≠ 实际送达；未观察到内部 ACL 执行，不绘制规则命中。'),
    h('section', { className: 'mpa-playback', 'aria-label': '过程播放控制' },
      h('div', { className: 'mpa-process-tools' },
        h('button', { type: 'button', onClick: () => { setLive(true); setPlaying(false) } }, '实时'),
        h('button', { type: 'button', onClick: () => seek(live ? count : cursor), disabled: !events.length }, '暂停画面'),
        h('button', { type: 'button', onClick: () => { setLive(false); if (count >= events.length) setCursor(0); setPlaying(!playing) }, disabled: !events.length }, playing ? '暂停回放' : '播放回放'),
        h('button', { type: 'button', onClick: () => seek(Math.min(events.length, count+1)), disabled: count >= events.length }, '单步'),
        h('select', { 'aria-label': '回放速度', value: speed, onChange: e => setSpeed(Number(e.target.value)) }, ...[0.5,1,2].map(value => h('option', { key: value, value }, `${value}×`))),
      ),
      h('input', { type: 'range', min: 0, max: events.length, value: count, onChange: e => seek(Number(e.target.value)), 'aria-label': '事件时间轴' }),
      h('small', null, `${count}/${events.length} 条 · ${time(events[count-1]?.time)} · 暂停画面不会暂停实际验收`),
      h('div', { className: 'mpa-process-tools' }, ...[['anomaly','下一异常'],['message.received','下一送达'],['check.ended','检查结束']].map(([type,label]) => h('button', { key: type, type: 'button', onClick: () => jump(type) }, label)), h('button', { type: 'button', disabled: !data.run?.parentRunId, onClick: () => { const i = events.findIndex(e => e.type === 'run.started'); seek(i < 0 ? 0 : i+1) } }, '复测开始')),
    ),
    h('details', { className: 'mpa-process-evidence', open: Boolean(selected) }, h('summary', null, selected ? `节点证据 · ${selected}` : '展开当前检查的技术证据'),
      selected ? h('button', { type: 'button', onClick: () => setSelected(null) }, '显示全部角色') : null,
      h('ol', null, ...selectedEvents.map(event => h('li', { key: event.seq }, h('strong', null, `#${event.seq} ${eventLabel(event)}`), h('span', null, ` · ${time(event.time)} · ${event.side} / ${event.role ?? '判定'}`), h('pre', null, JSON.stringify(event, null, 2))))),
    ),
    h('section', { className: 'mpa-jev-advice' }, h('h3', null, '建议与实际行动'),
      lastAdvice ? h('p', null, lastAdvice.available ? `Jev 建议：${lastAdvice.choice} · 置信度 ${lastAdvice.confidence} · ${lastAdvice.model}` : 'Jev 请求失败或响应无效，Agnes 继续规划。') : h('p', null, '当前所显示记录中未见实际 Jev 返回。'),
      lastAdvice?.probabilities ? h('details', null, h('summary', null, '候选概率'), h('pre', null, JSON.stringify(lastAdvice.probabilities,null,2))) : null,
      h('p', { className: 'mpa-view-note' }, '以下为当前会话的实际工具轨迹，与回放时间独立；不据此自动认定建议已采纳。'),
      h('ul', null, ...session.actions.slice(-8).map((action,i) => h('li', { key: `${action.seq}-${i}` }, `${AUDIT_TOOL_LABELS[action.name]} · ${action.status} · ${action.runId ?? '无运行标识'}`))),
    ),
    report ? h('section', { className: 'mpa-retest-comparison' }, h('h3', null, report.parentRunId ? '复测前后' : '本次结果'),
      h('p', null, `总体：${resultName(report.summary?.overall)} · ${report.coverage === 'partial' ? '仅所选范围' : '全量范围'}`),
      ...report.checks.map(check => { const before = parent?.checks.find(c => c.checkId === check.checkId); return h('p', { key: check.checkId }, `${check.checkId}：${before ? resultName(before.requirement) + ' → ' : ''}${resultName(check.requirement)}${before && before.requirement === check.requirement ? '（结论未改变）' : ''}`) }),
      report.parentRunId && !parent ? h('p', null, '原运行报告未能从当前会话取得，暂不能展示变化。') : null,
    ) : null,
    h('fieldset', { className: 'mpa-retest-picker' }, h('legend', null, '选择复测项'), ...CHECKS.map(id => h('label', { key: id }, h('input', { type: 'checkbox', checked: retests.includes(id), onChange: e => setRetests(old => e.target.checked ? [...old,id] : old.filter(v => v !== id)) }), id)),
      h('button', { type: 'button', disabled: sending || session.busy || !runId || !retests.length || !['completed','failed','interrupted'].includes(data.run?.status) || data.run?.round >= 2, onClick: () => submit(true) }, '请求复测'),
    ),
    message ? h('p', { role: 'status' }, message) : null,
    h('footer', { className: 'mpa-footer' }, runId ?? '等待当前会话运行'),
  )
}
