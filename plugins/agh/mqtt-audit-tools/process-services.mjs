import path from 'node:path'
import { RunStore, validRunId } from './run-store.mjs'

export function createProcessServices(resultsDir) {
  const store = new RunStore(resultsDir)
  const query = (name, properties, required, handler) => ({
    name, kind: 'query', timeoutMs: 1500, maxResultBytes: 512 * 1024,
    inputSchema: { type: 'object', properties, required, additionalProperties: false },
    outputSchema: { type: 'object', additionalProperties: true },
    async handler(input = {}) {
      try {
        if (Object.keys(input).some(key => !Object.hasOwn(properties, key)) || required.some(key => input[key] === undefined)) throw new Error('invalid-input')
        if ('runId' in properties && !validRunId(input.runId)) throw new Error('invalid-run-id')
        return handler(input)
      } catch (error) { return { status: error.code === 'ENOENT' ? 'empty' : 'error', message: '记录不可用或参数无效；观察可能不完整。' } }
    },
  })
  const run = { runId: { type: 'string', pattern: '^run-[A-Za-z0-9_-]{1,128}$' } }
  return [
    query('mqtt.audit.runstatus', run, ['runId'], ({ runId }) => { const { pid, ...state } = store.status(runId); return { status: 'ok', run: state } }),
    query('mqtt.audit.events', { ...run, afterSeq: { type: 'integer', minimum: 0 }, limit: { type: 'integer', minimum: 1, maximum: 200 } }, ['runId'], ({ runId, afterSeq, limit }) => store.events(runId, afterSeq, limit)),
    query('mqtt.audit.health', {}, [], () => {
      let snapshot
      try { snapshot = store.read(path.join(resultsDir, 'health.json')) } catch { snapshot = { sides: {}, sampledAt: null, monitoring: false } }
      const sampledAt = Date.parse(snapshot.sampledAt ?? '')
      return { status: 'ok', ...snapshot, stale: snapshot.monitoring !== true || !Number.isFinite(sampledAt) || Date.now() - sampledAt > 30000, mode: process.env.MQTT_AUDIT_JEV_ENABLED === 'true' ? 'Agnes + Jev' : 'Agnes' }
    }),
  ]
}
