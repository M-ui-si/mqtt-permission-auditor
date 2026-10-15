export const DASHBOARD_FILTERS = [
  { id: 'all', label: '全部检查' },
  { id: 'expansion', label: '权限扩大' },
  { id: 'damage', label: '业务受损' },
  { id: 'fail', label: '要求失败' },
  { id: 'unknown', label: '无法判定' },
  { id: 'pass', label: '通过' },
]

const REPORT_STALE_AFTER_MS = 15 * 60 * 1000

export function isAuditResultStale(result, now = Date.now()) {
  const generatedAt = Date.parse(result?.generatedAt ?? '')
  return !Number.isFinite(generatedAt) || now - generatedAt > REPORT_STALE_AFTER_MS
}

export function summarizeAuditResult(result) {
  const checks = Array.isArray(result?.checks) ? result.checks : []
  const sideCounts = (side) =>
    checks.reduce(
      (counts, check) => {
        const observed = check?.sides?.[side]?.observed
        if (observed === 'allow' || observed === 'deny') counts[observed] += 1
        else counts.unknown += 1
        return counts
      },
      { allow: 0, deny: 0, unknown: 0 },
    )

  return {
    totalChecks: checks.length,
    expansion: Array.isArray(result?.summary?.expansion) ? result.summary.expansion.length : 0,
    damage: Array.isArray(result?.summary?.damage) ? result.summary.damage.length : 0,
    requirementFailures: Array.isArray(result?.summary?.requirementFailures)
      ? result.summary.requirementFailures.length
      : 0,
    unknownChecks: checks.filter(
      (check) =>
        check?.requirement === 'unknown' ||
        check?.sides?.source?.observed === 'unknown' ||
        check?.sides?.target?.observed === 'unknown',
    ).length,
    passChecks: checks.filter((check) => check?.requirement === 'pass').length,
    source: sideCounts('source'),
    target: sideCounts('target'),
  }
}

export function filterAuditChecks(checks, filter) {
  const rows = Array.isArray(checks) ? checks : []
  switch (filter) {
    case 'expansion':
      return rows.filter((check) => check.expansion)
    case 'damage':
      return rows.filter((check) => check.damage)
    case 'fail':
      return rows.filter((check) => check.requirement === 'fail')
    case 'unknown':
      return rows.filter(
        (check) =>
          check.requirement === 'unknown' ||
          check.sides?.source?.observed === 'unknown' ||
          check.sides?.target?.observed === 'unknown',
      )
    case 'pass':
      return rows.filter((check) => check.requirement === 'pass')
    default:
      return rows
  }
}
