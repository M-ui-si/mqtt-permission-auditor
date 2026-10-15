/**
 * Adapted from AgnesAI-Labs/agnes-harness MHS hosts/agnes/index.tsx and layout/panel.tsx.
 * Upstream 4bc36bc4c4441206388a53bece17379c1d7be14d, Apache-2.0.
 * Modified: MQTT views/service adapter, keyboard resize, focus and lifecycle cleanup.
 * See the package's third-party/agnes-harness/README.md for provenance and license.
 */
import { createElement as h, useEffect, useRef, useSyncExternalStore } from 'react'

const RAIL = 36
const VIEWS = [['process', '过程'], ['overview', '概览'], ['compare', '对照'], ['activity', '轨迹']]
const storageKey = 'mqtt-permission-auditor.official-panel.'
function load(key, fallback) {
  try { return localStorage.getItem(storageKey + key) ?? fallback } catch { return fallback }
}
function save(key, value) {
  try { localStorage.setItem(storageKey + key, String(value)) } catch { /* Optional layout persistence. */ }
}
function clampWidth(width) {
  const max = Math.max(RAIL, window.innerWidth * 0.75)
  return Math.round(Math.min(Math.max(Number.isFinite(width) ? width : 460, Math.min(360, max)), max))
}

// Shared by the official-style dock, sidebar entry and full-screen console.
function createUi() {
  const view = load('view', 'process')
  let state = {
    open: load('open', 'true') === 'true',
    width: clampWidth(Number(load('width', '0')) || window.innerWidth * 0.36),
    full: false,
    view: VIEWS.some(([id]) => id === view) ? view : 'process',
  }
  const listeners = new Set()
  return {
    get: () => state,
    set(patch) {
      state = { ...state, ...patch }
      for (const key of ['open', 'width', 'view']) save(key, state[key])
      for (const listener of [...listeners]) listener()
    },
    subscribe(listener) { listeners.add(listener); return () => listeners.delete(listener) },
  }
}

export function mountOfficialShell(ctx, Dashboard, dashboardProps) {
  const ui = createUi()
  const useUi = () => useSyncExternalStore(ui.subscribe, ui.get)
  const sessionSnapshot = () => ctx.session.sessionId
  const subscribeSession = (listener) => ctx.session.subscribe(listener)
  let restoreFocus
  const openFull = () => {
    restoreFocus = document.activeElement
    ui.set({ full: true })
  }
  const closeFull = () => {
    ui.set({ full: false })
    requestAnimationFrame(() => {
      if (restoreFocus?.isConnected) restoreFocus.focus()
      else document.querySelector('.mpa-shell-expand')?.focus()
    })
  }

  function Panel({ full = false }) {
    const { view } = useUi()
    const sessionId = useSyncExternalStore(subscribeSession, sessionSnapshot)
    return h('div', { className: 'mpa-panel' },
      h('header', { className: 'mpa-panel-head' },
        h('strong', null, 'MQTT 验收'), h('span', { className: 'mpa-panel-tag' }, '本地'),
        h('nav', { className: 'mpa-segmented', 'aria-label': '验收视图' },
          ...VIEWS.map(([id, label]) => h('button', {
            key: id, type: 'button', 'aria-pressed': view === id, onClick: () => ui.set({ view: id }),
          }, label)),
        ),
        h('button', {
          type: 'button', className: 'mpa-shell-icon mpa-shell-expand',
          onClick: full ? closeFull : openFull,
          'aria-label': full ? '退出全屏' : '全屏查看', title: full ? '退出全屏（Esc）' : '全屏查看',
        }, full ? '⤡' : '⤢'),
      ),
      h('div', { className: 'mpa-panel-body' }, h(Dashboard, { ...dashboardProps, key: sessionId ?? 'none', sessionId, view })),
    )
  }

  function Dock() {
    const { open, width, full } = useUi()
    const dragCleanup = useRef(() => {})
    useEffect(() => {
      document.body.classList.add('mpa-official-docked')
      const resize = () => ui.set({ width: clampWidth(ui.get().width) })
      window.addEventListener('resize', resize)
      return () => {
        dragCleanup.current()
        window.removeEventListener('resize', resize)
        document.body.classList.remove('mpa-official-docked')
        document.documentElement.style.removeProperty('--mpa-dock-width')
      }
    }, [])
    useEffect(() => {
      document.documentElement.style.setProperty('--mpa-dock-width', `${open ? width : RAIL}px`)
    }, [open, width])
    function startDrag(event) {
      if (event.button !== 0) return
      event.preventDefault()
      dragCleanup.current()
      document.body.classList.add('mpa-resizing')
      const move = (e) => ui.set({ open: true, width: clampWidth(window.innerWidth - e.clientX) })
      const end = () => {
        document.body.classList.remove('mpa-resizing')
        window.removeEventListener('pointermove', move)
        window.removeEventListener('pointerup', end)
        window.removeEventListener('pointercancel', end)
      }
      dragCleanup.current = end
      window.addEventListener('pointermove', move)
      window.addEventListener('pointerup', end)
      window.addEventListener('pointercancel', end)
    }
    return h('section', { className: 'mpa-shell mpa-official-dock', 'data-open': open, 'aria-label': 'MQTT 权限迁移验收面板' },
      h('div', { className: 'mpa-seam' },
        h('div', {
          className: 'mpa-resizer', role: 'separator', tabIndex: 0, 'aria-label': '调整验收面板宽度',
          'aria-orientation': 'vertical', 'aria-valuenow': width,
          'aria-valuemin': Math.round(Math.min(360, window.innerWidth * 0.75)), 'aria-valuemax': Math.round(window.innerWidth * 0.75),
          onPointerDown: startDrag,
          onKeyDown: (event) => {
            if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return
            event.preventDefault()
            ui.set({ open: true, width: clampWidth(event.key === 'Home' ? 360 : event.key === 'End' ? window.innerWidth * 0.75 : width + (event.key === 'ArrowLeft' ? 32 : -32)) })
          },
        }),
        h('button', {
          type: 'button', className: 'mpa-shell-toggle', 'aria-expanded': open,
          'aria-label': open ? '收起 MQTT 验收面板' : '展开 MQTT 验收面板',
          onClick: () => ui.set({ open: !open }),
        }, open ? '›' : '‹'),
      ),
      open && !full ? h(Panel) : h('span', { className: 'mpa-rail-label' }, 'MQTT 验收'),
    )
  }

  function Console() {
    const { full } = useUi()
    const dialog = useRef(null)
    useEffect(() => {
      if (!full) return
      const getButtons = () => [...dialog.current.querySelectorAll('button:not(:disabled), select, summary, [tabindex="0"]')].filter((el) => el.getClientRects().length)
      getButtons()[0]?.focus()
      const keydown = (event) => {
        if (event.key === 'Escape') { event.preventDefault(); closeFull() }
        if (event.key === 'Tab') {
          const buttons = getButtons()
          const first = buttons[0], last = buttons.at(-1)
          if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus() }
          else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus() }
        }
      }
      document.addEventListener('keydown', keydown)
      return () => document.removeEventListener('keydown', keydown)
    }, [full])
    return full ? h('div', { ref: dialog, className: 'mpa-shell mpa-console', role: 'dialog', 'aria-modal': true, 'aria-label': 'MQTT 验收全屏视图' }, h(Panel, { full: true })) : null
  }
  function SidebarEntry() {
    const { open } = useUi()
    return h('button', { type: 'button', className: 'mpa-sidebar-entry', 'aria-pressed': open, onClick: () => ui.set({ open: !open }) },
      h('span', { 'aria-hidden': true }, '▦'), ' MQTT 验收')
  }

  ctx.slots.register('rightbar', Dock, { priority: -1 })
  ctx.slots.register('sidebar.panellist', SidebarEntry)
  ctx.slots.register('shell.overlay', Console)
}
