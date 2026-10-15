import { createElement as h, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { DASHBOARD_FILTERS, filterAuditChecks, isAuditResultStale, summarizeAuditResult } from '../../../dashboard-model.mjs'
import { AUDIT_TOOL_LABELS, readSessionDashboard } from '../../../dashboard-session.mjs'
import { mountOfficialShell } from './official-shell.js'
import { ProcessDashboard } from './process.js'

const OBSERVED = {
  allow: { label: '允许', className: 'allow' },
  deny: { label: '拒绝', className: 'deny' },
  unknown: { label: '无法判定', className: 'unknown' },
}

const REQUIREMENTS = {
  pass: { label: '符合要求', className: 'pass' },
  fail: { label: '不符合', className: 'fail' },
  unknown: { label: '待确认', className: 'unknown' },
}

function formatDate(value) {
  if (!value) return '时间未记录'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString('zh-CN', { hour12: false })
}

function Badge({ value, dictionary = OBSERVED }) {
  const item = dictionary[value] ?? dictionary.unknown
  return h('span', { className: `mpa-badge mpa-badge--${item.className}` }, item.label)
}

function SummaryLine({ label, value, tone, hint }) {
  return h('div', { className: `mpa-summary-line mpa-summary-line--${tone}` },
    h('span', { className: 'mpa-summary-line__label' }, label),
    h('span', { className: 'mpa-summary-line__hint' }, hint),
    h('strong', { className: 'mpa-summary-line__value' }, String(value)),
  )
}

function SideHealth({ label, health, broker }) {
  const state = health?.ok === true ? 'up' : health?.ok === false ? 'down' : 'unknown'
  return h('div', { className: `mpa-health is-${state}`, title: broker?.endpoint ?? '' },
    h('span', { className: 'mpa-health__dot', 'aria-hidden': true }),
    h('span', { className: 'mpa-health__name' }, label),
    h('span', { className: 'mpa-health__state' }, state === 'up' ? '正常' : state === 'down' ? '不可用' : '未知'),
  )
}

function CheckRow({ check, selected, onSelect, detailsId }) {
  const action = check.action === 'publish' ? '发布' : check.action === 'subscribe' ? '订阅' : check.action
  const topic = check.topic ?? check.filter ?? '主题未记录'
  const riskClass = check.expansion ? 'is-expansion' : check.damage ? 'is-damage' : check.requirement === 'fail' ? 'is-fail' : ''
  const source = check.sides?.source?.observed
  const target = check.sides?.target?.observed
  return h('button', {
    type: 'button',
    className: `mpa-check-row ${riskClass} ${selected ? 'is-selected' : ''}`,
    onClick: onSelect,
    'aria-expanded': selected,
    ...(selected ? { 'aria-controls': detailsId } : {}),
  },
    h('span', { className: 'mpa-check-row__main' },
      h('span', { className: 'mpa-check-row__identity' },
        h('span', { className: 'mpa-check-row__id' }, check.checkId ?? check.id ?? '—'),
        check.identity ?? '身份未知',
      ),
      h('span', { className: 'mpa-check-row__topic', title: topic }, `${action} · ${topic}`),
    ),
    h('span', { className: 'mpa-check-row__result' }, h(Badge, { value: check.requirement, dictionary: REQUIREMENTS })),
    h('span', { className: 'mpa-check-row__comparison' },
      h('span', null, '源端 ', h(Badge, { value: source })),
      h('span', { className: 'mpa-arrow', 'aria-hidden': true }, '→'),
      h('span', null, '目标端 ', h(Badge, { value: target })),
    ),
  )
}

function EvidencePanel({ check, id }) {
  if (!check) return null
  const sides = [
    ['迁移前 · Mosquitto', check.sides?.source, check.evidence?.source],
    ['迁移后 · EMQX', check.sides?.target, check.evidence?.target],
  ]
  return h('section', { id, className: 'mpa-evidence', 'aria-label': '所选检查的证据详情' },
    h('p', { className: 'mpa-evidence__expectation' },
      '业务要求：', check.expect === 'allow' ? '必须允许' : '必须拒绝',
      '；', check.expansion ? '已证实权限扩大' : check.damage ? '已证实业务受损' : '未形成已证实差异',
    ),
    h('div', { className: 'mpa-evidence__sides' },
      ...sides.map(([label, side, evidence]) => h('article', { className: 'mpa-evidence-card', key: label },
        h('div', { className: 'mpa-evidence-card__top' }, h('strong', null, label), h(Badge, { value: side?.observed })),
        h('p', { className: 'mpa-reason' }, side?.reason ?? '没有附加原因'),
        Object.entries(evidence ?? {}).length
          ? h('details', { className: 'mpa-evidence-raw' },
              h('summary', null, '查看原始证据'),
              h('dl', { className: 'mpa-evidence-list' },
                ...Object.entries(evidence).map(([key, value]) => h('div', { key },
                  h('dt', null, key),
                  h('dd', null, typeof value === 'string' ? value : JSON.stringify(value)),
                )),
              ),
            )
          : null,
      )),
    ),
  )
}

function AuditDashboard({ callLatest, readProjection, subscribeProjection, refreshIntervalMs = 15000, sessionId, view = 'overview' }) {
  const [state, setState] = useState({ status: 'loading' })
  const [busy, setBusy] = useState(false)
  const [filter, setFilter] = useState('all')
  const [selectedId, setSelectedId] = useState(null)
  const requestSequence = useRef(0)

  const readCurrent = useCallback(async () => {
    return readSessionDashboard({ sessionId, readProjection, callLatest })
  }, [readProjection, sessionId, callLatest])

  const refresh = async () => {
    const request = ++requestSequence.current
    setBusy(true)
    try {
      const response = await readCurrent()
      if (request === requestSequence.current) setState(response && typeof response === 'object' ? response : { status: 'error', message: '服务返回了无效数据。' })
    } catch {
      if (request === requestSequence.current) setState({ status: 'error', message: '无法读取本次结果。请确认 AGH 会话服务能力已启用，然后重试。' })
    } finally {
      if (request === requestSequence.current) setBusy(false)
    }
  }

  useEffect(() => {
    let alive = true
    let timer
    const load = async () => {
      const request = ++requestSequence.current
      try {
        const response = await readCurrent()
        if (alive && request === requestSequence.current) setState(response && typeof response === 'object' ? response : { status: 'error', message: '服务返回了无效数据。' })
      } catch {
        if (alive && request === requestSequence.current) setState({ status: 'error', message: '无法读取本次结果。请确认 AGH 会话服务能力已启用，然后重试。' })
      } finally {
        if (alive && request === requestSequence.current) setBusy(false)
      }
    }
    void load()
    const unsubscribe = subscribeProjection(load)
    timer = setInterval(() => {
      if (document.visibilityState === 'visible') void load()
    }, Math.max(10000, refreshIntervalMs))
    return () => {
      alive = false
      ++requestSequence.current
      clearInterval(timer)
      unsubscribe?.()
    }
  }, [readCurrent, subscribeProjection, refreshIntervalMs, sessionId])

  const result = state.status === 'ok' ? state.result : null
  const summary = useMemo(() => summarizeAuditResult(result), [result])
  const rows = useMemo(() => filterAuditChecks(result?.checks, filter), [result, filter])
  const resultIsStale = isAuditResultStale(result)
  const overall = result?.summary?.overall ?? 'unknown'
  const overallLabel = { pass: '验收通过', fail: '发现问题', unknown: '证据不足' }[overall] ?? '等待结果'

  if (view === 'activity') {
    const labels = { completed: '已完成', succeeded: '已完成', running: '执行中', planned: '待执行', awaiting_approval: '等待审批', failed: '失败', cancelled: '已取消' }
    return h('div', { className: 'mpa-dashboard' },
      h('header', { className: 'mpa-header' }, h('h2', null, '当前会话轨迹'),
        h('button', { type: 'button', className: 'mpa-refresh', onClick: refresh, disabled: busy }, '刷新')),
      h('p', { className: 'mpa-view-note' }, '按会话中的调用顺序展示。工具完成状态不代表验收通过。'),
      state.activity?.length ? h('ol', { className: 'mpa-activity' }, ...state.activity.map((call, i) => h('li', { key: `${call.seq ?? i}-${call.name}` },
        h('strong', null, AUDIT_TOOL_LABELS[call.name]),
        h('span', { className: 'mpa-activity-status' }, labels[call.status] ?? '状态未知'),
        h('code', null, call.name),
      ))) : h('p', { role: 'status' }, state.status === 'loading' ? '正在读取轨迹…' : state.status === 'empty' ? '当前会话还没有 MQTT 工具调用。' : state.message ?? '轨迹暂不可读，请刷新重试。'),
      state.message && state.activity?.length ? h('p', { role: 'status', className: 'mpa-view-note' }, state.message) : null,
      result ? h('footer', { className: 'mpa-footer' }, `对应报告：${result.runId}`) : null,
    )
  }

  if (state.status === 'loading') {
    return h('div', { className: 'mpa-dashboard mpa-state', role: 'status' },
      h('h2', null, '正在读取验收结果'),
      h('p', null, '正在读取当前会话的报告。'),
    )
  }

  if (state.status === 'running') {
    return h('div', { className: 'mpa-dashboard mpa-state', role: 'status' },
      h('h2', null, '正在验收'),
      h('p', null, '正在采集两端消息送达与协议证据，完成后自动显示本次结果。'),
      h('button', { type: 'button', className: 'mpa-button', onClick: refresh, disabled: busy }, busy ? '读取中…' : '刷新状态'),
    )
  }

  if (state.status === 'empty') {
    return h('div', { className: 'mpa-dashboard mpa-state' },
      h('h2', null, '还没有验收结果'),
      h('p', null, '在左侧对话中提出“验收本地 MQTT 权限迁移”。Agnes 运行后，结论会显示在这里。'),
      h('button', { type: 'button', className: 'mpa-button', onClick: refresh, disabled: busy }, busy ? '读取中…' : '刷新结果'),
    )
  }

  if (state.status !== 'ok' || !result) {
    return h('div', { className: 'mpa-dashboard mpa-state mpa-state--error', role: 'alert' },
      h('h2', null, '暂时无法展示结果'),
      h('p', null, state.message ?? '请检查结果服务状态后重试。'),
      h('button', { type: 'button', className: 'mpa-button', onClick: refresh, disabled: busy }, busy ? '正在刷新…' : '重试'),
    )
  }

  const filters = DASHBOARD_FILTERS
  return h('div', { className: `mpa-dashboard mpa-view-${view}` },
    h('header', { className: 'mpa-header' },
      h('div', null,
        h('h2', null, view === 'compare' ? '迁移前后对照' : '权限迁移验收'),
        h('span', { className: 'mpa-route' }, 'Mosquitto → EMQX'),
      ),
      h('button', { type: 'button', className: 'mpa-refresh', onClick: refresh, disabled: busy, 'aria-label': '刷新验收结果' }, busy ? '读取中…' : '刷新'),
    ),

    h('section', { className: `mpa-verdict mpa-verdict--${overall}`, 'aria-label': '总体验收结论' },
      h('span', { className: 'mpa-verdict__label' }, '最近一次验收'),
      h('strong', { className: 'mpa-verdict__value' }, overallLabel),
      h('span', { className: 'mpa-verdict__meta' }, `${summary.totalChecks} 项检查 · ${formatDate(result.generatedAt)}`),
    ),

    h('div', { className: 'mpa-report-meta' },
      h('span', { title: result.caseSet?.description ?? '' }, '当前会话 · ', result.caseSet?.id ?? '固定案例集'),
      resultIsStale ? h('span', { className: 'mpa-stale', role: 'status' }, '结果已过期') : null,
    ),

    h('section', { className: 'mpa-summary', 'aria-label': '验收维度' },
      h(SummaryLine, { label: '权限扩大', value: summary.expansion, tone: 'danger', hint: '源拒绝，目标允许' }),
      h(SummaryLine, { label: '业务受损', value: summary.damage, tone: 'warning', hint: '必需操作受阻' }),
      h(SummaryLine, { label: '要求不符', value: summary.requirementFailures, tone: 'danger', hint: '独立业务要求' }),
      h(SummaryLine, { label: '无法判定', value: summary.unknownChecks, tone: 'unknown', hint: '证据不足' }),
    ),

    h('section', { className: 'mpa-brokers', 'aria-label': 'Broker 状态' },
      h(SideHealth, { label: 'Mosquitto', health: result.brokers?.source?.health, broker: result.brokers?.source }),
      h(SideHealth, { label: 'EMQX', health: result.brokers?.target?.health, broker: result.brokers?.target }),
    ),

    view === 'overview' ? h('section', { className: 'mpa-requirements' },
      h('h3', null, '业务要求'),
      h('ul', null, ...(result.caseSet?.requirements ?? []).map((requirement, i) => h('li', { key: i }, requirement))),
      h('p', { className: 'mpa-view-note' }, '在“对照”中查看每项检查的源端、目标端观测和原始证据。Broker 状态来自本次报告，不代表当前实时健康状态。'),
    ) : null,

    h('section', { className: 'mpa-checks' },
      h('div', { className: 'mpa-checks__heading' },
        h('h3', null, '检查项'),
        h('span', { className: 'mpa-checks__count' }, `${rows.length}/${summary.totalChecks}`),
        h('label', { className: 'mpa-filter-label' },
          h('span', { className: 'mpa-sr-only' }, '筛选检查项'),
          h('select', {
            className: 'mpa-filter-select',
            value: filter,
            onChange: (event) => { setFilter(event.target.value); setSelectedId(null) },
          }, ...filters.map((item) => h('option', { key: item.id, value: item.id }, item.label))),
        ),
      ),
      rows.length
        ? h('div', { className: 'mpa-check-list' },
            ...rows.map((check) => {
              const id = check.checkId ?? check.id
              const selected = selectedId === id
              const detailsId = `mpa-evidence-${id}`
              return h('div', { className: `mpa-check-item ${selected ? 'is-open' : ''}`, key: id },
                h(CheckRow, {
                  check,
                  selected,
                  detailsId,
                  onSelect: () => setSelectedId((old) => old === id ? null : id),
                }),
                selected ? h(EvidencePanel, { check, id: detailsId }) : null,
              )
            }),
          )
        : h('p', { className: 'mpa-empty-filter' }, '没有符合筛选条件的检查项。'),
    ),

    h('footer', { className: 'mpa-footer' },
      h('span', { title: result.runId ?? '' }, `运行 ${result.runId ?? '未记录'}`),
      h('span', null, '未知不等于拒绝；仅展示核心结论。'),
    ),
  )
}

export function apply(ctx, config) {
  const callService = (name, input) => ctx.agnes.services.call(name, input)
  const callLatest = (runId) => ctx.agnes.services.call('mqtt.audit.latestresult', { runId })
  const readProjection = () => ctx.session.projection.read('session.ui')
  const subscribeProjection = (listener) => ctx.session.projection.subscribe(listener)
  const submitPrompt = (sessionId, text) => {
    if (ctx.session.sessionId !== sessionId) throw new Error('session-changed')
    return ctx.session.commands.prompt({ text })
  }
  function Dashboard(props) {
    return props.view === 'process' ? h(ProcessDashboard, props) : h(AuditDashboard, props)
  }
  mountOfficialShell(ctx, Dashboard, {
    callLatest, readProjection, subscribeProjection,
    callService, submitPrompt,
    refreshIntervalMs: config?.publicConfig?.refreshIntervalMs ?? 15000,
  })
}
