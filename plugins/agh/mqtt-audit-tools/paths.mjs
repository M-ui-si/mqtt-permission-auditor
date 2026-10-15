import { statSync } from 'node:fs'
import path from 'node:path'

export function resolveCredentialCandidates(root, credsPath, workspaceRoot = process.cwd(), configuredCreds = process.env.MQTT_AUDIT_CREDS) {
  return credsPath
    ? [credsPath]
    : [
        configuredCreds,
        path.join(workspaceRoot, '.local', 'reproducible', 'creds.json'),
        path.join(root, '..', '..', '..', '.local', 'reproducible', 'creds.json'),
        path.join(workspaceRoot, '.local', 'env', 'creds.json'),
        path.join(root, '..', '..', '..', '.local', 'env', 'creds.json'),
      ].filter(Boolean)
}

export function resolveResultsDirectory({ root, credsPath, resultsDir, workspaceRoot, configuredCreds } = {}) {
  if (resultsDir) return resultsDir
  const candidates = resolveCredentialCandidates(root, credsPath, workspaceRoot, configuredCreds)
  const creds = candidates.find((candidate) => {
    try {
      return Boolean(requireFile(candidate))
    } catch {
      return false
    }
  }) ?? candidates[0]
  return path.join(path.dirname(creds), 'agh-runs')
}

function requireFile(candidate) {
  // Kept local to avoid exposing credential contents to callers of this helper.
  return statSync(candidate).isFile()
}
