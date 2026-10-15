import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { randomUUID } from 'node:crypto'
import { probePublish } from './core/prober.mjs'
import { validateBroker } from './core/runner.mjs'
import { resolveCredentialCandidates } from './paths.mjs'
import { RunStore } from './run-store.mjs'

export function startHealthMonitor({ root, resultsDir, credsPath, intervalMs = 10000, probe = probePublish }) {
  const store = new RunStore(resultsDir)
  const controller = new AbortController()
  let busy = false, stopped = false
  const sample = async () => {
    if (busy || stopped) return
    busy = true
    try {
      const credential = resolveCredentialCandidates(root, credsPath).find(file => existsSync(file))
      if (!credential) return
      const creds = JSON.parse(readFileSync(credential, 'utf8'))
      const instance = JSON.parse(readFileSync(path.join(root, 'instances.json'), 'utf8'))['local-isolated']
      for (const side of ['source','target']) validateBroker(instance[side], side)
      const sides = {}
      await Promise.all(['source','target'].map(async side => {
        let connected = false
        const witness = instance.witness ?? 'auditor'
        let result
        try {
          result = await probe({ broker: instance[side], identity: 'device-sensor', password: creds['device-sensor'], witness, witnessPassword: creds[witness], topic: 'telemetry/up', tag: `health:${randomUUID()}`, timeouts: { connect: 1000, ack: 1000, delivery: 1500 }, signal: controller.signal,
            onEvent: event => { if (event.type === 'connect.result' && event.ok) connected = true } })
        } catch {
          // A probe error is an incomplete observation, not evidence of an ACL denial.
        }
        sides[side] = { connection: connected ? 'connected' : result ? 'unreachable' : 'unknown', roundtrip: result?.observed === 'allow' ? 'received' : 'unknown', sampledAt: new Date().toISOString() }
      }))
      if (!stopped) store.write(path.join(resultsDir, 'health.json'), { sides, sampledAt: new Date().toISOString(), monitoring: true })
    } catch {
      // A previous successful snapshot ages out; never synthesize a healthy result.
    } finally { busy = false }
  }
  const timer = setInterval(sample, intervalMs)
  timer.unref?.()
  void sample()
  return () => {
    if (stopped) return
    stopped = true
    clearInterval(timer)
    controller.abort()
    try {
      const file = path.join(resultsDir, 'health.json')
      const snapshot = store.read(file)
      store.write(file, { ...snapshot, monitoring: false })
    } catch { /* No valid sample exists yet; the query service will report stale. */ }
  }
}
