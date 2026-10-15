import { mkdirSync, readFileSync, writeFileSync, appendFileSync, renameSync, unlinkSync, lstatSync, openSync, readSync, closeSync } from 'node:fs'
import path from 'node:path'
import { randomUUID } from 'node:crypto'
import { StringDecoder } from 'node:string_decoder'

export const validRunId = id => typeof id === 'string' && /^run-[A-Za-z0-9_-]{1,128}$/.test(id)
export const CHECK_IDS = ['c1','c2','c3','c4','c5','c6','c7','c8']
const alive = pid => { try { process.kill(pid, 0); return true } catch (e) { return e.code !== 'ESRCH' } }
export class RunStore {
  constructor(directory) { this.directory = directory }
  file(id, suffix) { if (!validRunId(id)) throw new Error('invalid-run-id'); return path.join(this.directory, `${id}.${suffix}`) }
  read(file, max = 512 * 1024) {
    const stat = lstatSync(file)
    if (!stat.isFile() || stat.isSymbolicLink() || stat.size > max) throw new Error('unsafe-record')
    return JSON.parse(readFileSync(file, 'utf8'))
  }
  write(file, data) {
    mkdirSync(this.directory, { recursive: true })
    const temporary = `${file}.${randomUUID()}.tmp`
    writeFileSync(temporary, JSON.stringify(data), { flag: 'wx' })
    renameSync(temporary, file)
  }
  status(id) {
    const state = this.read(this.file(id, 'state.json'))
    if (state.runId !== id) throw new Error('invalid-record')
    if (state.status === 'running' && !alive(state.pid)) return { ...state, status: 'interrupted', observationIncomplete: true }
    return state
  }
  prepare({ checkIds = CHECK_IDS, parentRunId } = {}) {
    if (!Array.isArray(checkIds) || !checkIds.length || new Set(checkIds).size !== checkIds.length || checkIds.some(id => !CHECK_IDS.includes(id))) throw new Error('invalid-checks')
    let parent
    if (parentRunId) {
      parent = this.status(parentRunId)
      if (!['completed','failed','interrupted'].includes(parent.status)) throw new Error('parent-not-finished')
      if (parent.round >= 2) throw new Error('retest-limit')
    } else if (checkIds.length !== 8) throw new Error('initial-run-must-be-full')
    const runId = `run-${randomUUID()}`
    const state = { runId, status: 'prepared', caseId: 'migration-baseline', instanceId: 'local-isolated', checkIds, parentRunId: parentRunId ?? null, rootRunId: parent?.rootRunId ?? runId, round: parent ? parent.round + 1 : 0, scope: checkIds.length === 8 ? 'full' : 'partial', createdAt: new Date().toISOString(), lastSeq: 0, completedChecks: 0 }
    this.write(this.file(runId, 'state.json'), state)
    this.emit(runId, { type: 'run.prepared' })
    return this.status(runId)
  }
  lock(name) {
    mkdirSync(this.directory, { recursive: true })
    const file = path.join(this.directory, `${name}.lock`)
    try { writeFileSync(file, JSON.stringify({ pid: process.pid }), { flag: 'wx' }) }
    catch (e) {
      if (e.code !== 'EEXIST') throw e
      const old = this.read(file)
      if (alive(old.pid)) throw new Error('instance-busy')
      // Serialize dead-owner recovery, then recheck: two reclaimers must not
      // unlink a newly acquired live lock. A damaged recovery guard fails closed.
      const guard = `${file}.recovery`
      writeFileSync(guard, '', { flag: 'wx' })
      try {
        let current
        try { current = this.read(file) } catch (err) { if (err.code !== 'ENOENT') throw err }
        if (current && alive(current.pid)) throw new Error('instance-busy')
        if (current) unlinkSync(file)
        writeFileSync(file, JSON.stringify({ pid: process.pid }), { flag: 'wx' })
      } finally { unlinkSync(guard) }
    }
    return () => { try { unlinkSync(file) } catch {} }
  }
  begin(id) {
    const release = this.lock('local-isolated')
    try {
      const state = this.status(id)
      if (state.status !== 'prepared') throw new Error('run-already-executed')
      this.write(this.file(id, 'state.json'), { ...state, status: 'running', pid: process.pid })
      this.emit(id, { type: 'run.started' })
      return release
    } catch (e) { release(); throw e }
  }
  emit(id, input) {
    const state = this.status(id)
    const event = { runId: id, seq: state.lastSeq + 1, time: new Date().toISOString() }
    // Explicit allowlist: credentials, payloads, arbitrary errors and paths never enter the journal.
    for (const key of ['type','checkId','side','role','identity','topic','action','correlationId','ok','code','grants','observed','requirement','reason','choice','confidence','probabilities','model','available']) {
      if (input[key] !== undefined) event[key] = input[key]
    }
    appendFileSync(this.file(id, 'events.jsonl'), JSON.stringify(event) + '\n')
    const status = { 'run.completed': 'completed', 'run.failed': 'failed', 'run.interrupted': 'interrupted' }[event.type] ?? state.status
    this.write(this.file(id, 'state.json'), { ...state, status, lastSeq: event.seq, updatedAt: event.time, currentCheck: event.checkId ?? state.currentCheck, phase: event.type, completedChecks: state.completedChecks + (event.type === 'check.ended' ? 1 : 0) })
    return event
  }
  events(id, afterSeq = 0, limit = 200) {
    if (!Number.isSafeInteger(afterSeq) || afterSeq < 0 || !Number.isInteger(limit) || limit < 1 || limit > 200) throw new Error('invalid-cursor')
    const file = this.file(id, 'events.jsonl')
    const stat = lstatSync(file)
    if (!stat.isFile() || stat.isSymbolicLink() || stat.size > 32 * 1024 * 1024) throw new Error('unsafe-record')
    // Bound memory and returned events, tolerate a currently incomplete trailing append.
    const fd = openSync(file, 'r'), buffer = Buffer.alloc(8192), decoder = new StringDecoder('utf8'), events = []
    let pending = '', last = 0, incomplete = false, truncated = false
    try {
      outer: for (;;) {
        const size = readSync(fd, buffer, 0, buffer.length, null)
        if (!size) break
        pending += decoder.write(buffer.subarray(0, size))
        let end
        while ((end = pending.indexOf('\n')) >= 0) {
          const line = pending.slice(0, end); pending = pending.slice(end + 1)
          let event
          try { event = JSON.parse(line) } catch { incomplete = true; continue }
          if (event.runId !== id || !Number.isSafeInteger(event.seq) || event.seq !== last + 1) incomplete = true
          last = event.seq
          if (event.runId === id && event.seq > afterSeq) events.push(event)
          if (events.length >= limit) { truncated = true; break outer }
        }
        if (pending.length > 65536) throw new Error('oversized-event')
      }
    } finally { closeSync(fd) }
    // A batch cut at the limit still has whole lines buffered; hasMore expresses that
    // truncation. Only an unread remainder after consuming the file is a partial append.
    if (pending.length > 0 && !truncated) incomplete = true
    const state = this.status(id)
    if (events.length < limit && last < state.lastSeq) incomplete = true
    return { status: 'ok', events, lastSeq: state.lastSeq, incomplete, hasMore: (events.at(-1)?.seq ?? afterSeq) < state.lastSeq }
  }
}
