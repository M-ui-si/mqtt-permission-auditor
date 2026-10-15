import { readFileSync, lstatSync } from 'node:fs'
import path from 'node:path'

const MAX_RESULT_BYTES = 512 * 1024

const runInputSchema = {
  type: 'object',
  properties: { runId: { type: 'string', pattern: '^run-[A-Za-z0-9_-]{1,128}$' } },
  required: ['runId'],
  additionalProperties: false,
}

const latestResultSchema = {
  type: 'object',
  properties: {
    status: { type: 'string', enum: ['ok', 'empty', 'error'] },
    result: { type: 'object', additionalProperties: true },
    message: { type: 'string' },
  },
  required: ['status'],
  additionalProperties: false,
}

function isAuditResult(value) {
  return Boolean(
    value &&
      typeof value === 'object' &&
      value.schema === 'mqtt-permission-audit/1' &&
      Array.isArray(value.checks) &&
      value.summary &&
      typeof value.summary === 'object',
  )
}

export function createLatestAuditService(resultsDir) {
  return {
    name: 'mqtt.audit.latestresult',
    kind: 'query',
    inputSchema: runInputSchema,
    outputSchema: latestResultSchema,
    timeoutMs: 1500,
    maxResultBytes: MAX_RESULT_BYTES,
    async handler(input = {}) {
      try {
        if (Object.keys(input).some((key) => key !== 'runId') || !/^run-[A-Za-z0-9_-]{1,128}$/.test(input.runId ?? '')) return { status: 'error', message: '无效的运行标识。' }
        const file = path.join(resultsDir, `${input.runId}.json`)
        const stat = lstatSync(file)
        if (!stat.isFile() || stat.isSymbolicLink() || stat.size > MAX_RESULT_BYTES) {
          return { status: 'error', message: '运行结果无法安全读取或超过面板读取上限。' }
        }
        const result = JSON.parse(readFileSync(file, 'utf8'))
        if (!isAuditResult(result) || result.runId !== input.runId) return { status: 'error', message: '运行结果格式或标识不匹配。' }
        return { status: 'ok', result }
      } catch (error) {
        if (error?.code === 'ENOENT') return { status: 'empty', message: '当前会话尚无已完成的 MQTT 验收报告。' }
        return { status: 'error', message: '读取当前运行结果失败。' }
      }
    },
  }
}
