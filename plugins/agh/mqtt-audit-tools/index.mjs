// MQTT Permission Auditor 的 AGH 受控工具插件。
// 依据上游后端插件教程（vendor/agnes-harness/docs/develop/backend.zh-CN.md）的模式：
// 无外部依赖、TypeBox 参数以 Kind 符号手写、execute 返回 { content, structured }。
//
// 边界（与 AGENTS.md 一致）：
// - 只接受枚举的案例 id 与固定本地实例标识，不接受任意路径、Shell、URL 或模型参数；
// - 不持有模型 Key；仅显式启用时由受控建议工具调用固定 Jev 接口，Agnes 保留主循环；
// - 合成凭据从固定候选路径读取（环境变量或工作区 .local/reproducible、.local/env），不入插件快照；
// - 效果仅限本地隔离 Broker 的合成消息与结果文件写入（被忽略目录）。

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { runAudit } from './core/runner.mjs'
import { resolveCredentialCandidates, resolveResultsDirectory } from './paths.mjs'
import { createLatestAuditService } from './dashboard-service.mjs'
import { randomUUID } from 'node:crypto'
import { RunStore, CHECK_IDS } from './run-store.mjs'
import { createProcessServices } from './process-services.mjs'
import { startHealthMonitor } from './health-monitor.mjs'
import { planNext } from './jev.mjs'

const Kind = Symbol.for('TypeBox.Kind')

const listCasesParameters = {
  [Kind]: 'Object',
  type: 'object',
  properties: {},
  required: [],
  additionalProperties: false,
}

// 用 pattern 锁定枚举值（当前各只有一个合法值），配合 additionalProperties:false 防注入。
const runCheckParameters = {
  [Kind]: 'Object',
  type: 'object',
  properties: {
    caseId: { [Kind]: 'String', type: 'string', pattern: '^migration-baseline$', description: '案例集 id（枚举：migration-baseline）' },
    instanceId: { [Kind]: 'String', type: 'string', pattern: '^local-isolated$', description: '本地实例标识（枚举：local-isolated）' },
    runId: { [Kind]: 'String', type: 'string', pattern: '^run-[A-Za-z0-9_-]{1,128}$', description: '准备工具返回的运行标识；省略时执行全量验收' },
  },
  required: ['caseId'],
  additionalProperties: false,
}

const readResultParameters = {
  [Kind]: 'Object',
  type: 'object',
  properties: {
    runId: { [Kind]: 'String', type: 'string', pattern: '^run-[A-Za-z0-9_-]{1,128}$', description: 'run_check 返回的运行标识' },
  },
  required: ['runId'],
  additionalProperties: false,
}

const readMeta = {
  isReadOnly: true,
  isDestructive: false,
  isConcurrencySafe: true,
  isOpenWorld: false,
  replay: 'safe',
  costHint: undefined,
  deferLoading: false,
  requiresApproval: 'never',
}

// run_check 会向本地隔离 Broker 发送合成消息并写入结果文件（被忽略目录），
// 因此不是只读，但无破坏性、不开放外部世界。
const runMeta = { ...readMeta, isReadOnly: false }
const prepareParameters = {
  ...runCheckParameters,
  properties: {
    caseId: runCheckParameters.properties.caseId,
    instanceId: runCheckParameters.properties.instanceId,
    parentRunId: readResultParameters.properties.runId,
    checkIds: { [Kind]: 'Array', type: 'array', minItems: 1, maxItems: 8, uniqueItems: true, items: { [Kind]: 'String', type: 'string', pattern: '^c[1-8]$' } },
  },
}

function loadJson(file) {
  return JSON.parse(readFileSync(file, 'utf8'))
}

function packageRoot() {
  return path.dirname(fileURLToPath(import.meta.url))
}

// 依赖注入点：单测传入临时目录与假 runner；正式注册用默认解析。
export function buildToolDefs({
  packageRoot: root = packageRoot(),
  credsPath,
  resultsDir,
  runAuditImpl = runAudit,
} = {}) {
  const casesDir = path.join(root, 'fixtures', 'cases')
  const instancesFile = path.join(root, 'instances.json')

  const credsCandidates = resolveCredentialCandidates(root, credsPath)
  const resolvedCreds = credsCandidates.find((p) => existsSync(p)) ?? credsCandidates[0]
  const resolvedResults = resolveResultsDirectory({ root, credsPath: resolvedCreds, resultsDir })
  const memoryResults = new Map()
  const store = new RunStore(resolvedResults)

  const toolResult = (structured) => ({
    content: [{ type: 'text', text: JSON.stringify(structured) }],
    structured,
  })

  const fail = (code, message, extra = {}) => toolResult({ schema: 'mqtt-permission-audit-tool/1', status: 'error', code, message, ...extra })

  return [
    {
      name: 'mqtt_audit_list_cases',
      description: '列出可运行的 MQTT 权限迁移验收案例集（id、说明、检查项与期望）。',
      parameters: listCasesParameters,
      meta: readMeta,
      async execute() {
        const caseFile = path.join(casesDir, 'migration-baseline.json')
        if (!existsSync(caseFile)) return fail('case-file-missing', '案例集文件缺失', { caseFile })
        const caseSet = loadJson(caseFile)
        return toolResult({
          schema: 'mqtt-permission-audit-tool/1',
          status: 'ok',
          cases: [
            {
              id: caseSet.id,
              description: caseSet.description,
              requirements: caseSet.requirements ?? [],
              checks: (caseSet.checks ?? []).map((c) => ({ id: c.id, identity: c.identity, action: c.action, topic: c.filter ?? c.topic, expect: c.expect })),
            },
          ],
        })
      },
    },
    {
      name: 'mqtt_audit_run_check',
      description: '对固定本地实例运行所选案例集的迁移验收（源端 Mosquitto / 目标端 EMQX，合成数据），返回三态结论与维度汇总的结构化结果。',
      parameters: runCheckParameters,
      meta: runMeta,
      async execute({ caseId, instanceId = 'local-isolated', runId: preparedId }, context) {
        if (caseId !== 'migration-baseline' || instanceId !== 'local-isolated') return fail('invalid-selection', '仅允许固定案例 migration-baseline 与实例 local-isolated。')
        let runId, release
        let instance, caseSet
        const caseFile = path.join(casesDir, `${caseId}.json`)
        try {
          instance = loadJson(instancesFile)[instanceId]
          caseSet = loadJson(caseFile)
          if (!instance) throw new Error('Missing instance')
        } catch {
          return fail('configuration-unavailable', '插件固定案例或实例配置缺失，请重新安装插件。')
        }
        if (!existsSync(resolvedCreds)) {
          return fail('creds-unavailable', '合成凭据文件不存在；请准备固定本地环境或检查 MQTT_AUDIT_CREDS。')
        }

        let result
        try {
          const prepared = preparedId ? store.status(preparedId) : store.prepare()
          runId = prepared.runId
          release = store.begin(runId)
          caseSet = { ...caseSet, checks: caseSet.checks.filter(check => prepared.checkIds.includes(check.id)) }
          result = await runAuditImpl({
            caseSet,
            brokers: { source: instance.source, target: instance.target },
            creds: loadJson(resolvedCreds),
            witness: instance.witness ?? 'auditor',
            runId,
            onEvent: event => store.emit(runId, event),
          })
        } catch (err) {
          if (release) { try { store.emit(runId, { type: 'run.failed' }) } catch {} }
          release?.()
          return fail('run-failed', '验收未完成，请检查运行状态或本地实例是否忙碌。', { ...(runId ? { runId } : {}) })
        }

        const runState = store.status(runId)
        result = { runId, instanceId, ...result, checkIds: runState.checkIds, parentRunId: runState.parentRunId, rootRunId: runState.rootRunId, round: runState.round, coverage: runState.scope }
        memoryResults.set(runId, result)
        try {
          mkdirSync(resolvedResults, { recursive: true })
          writeFileSync(path.join(resolvedResults, `${runId}.json`), JSON.stringify(result, null, 2), 'utf8')
          store.emit(runId, { type: 'run.completed' })
        } catch (err) {
          result.storageWarning = '记录写入失败，过程观察可能不完整（内存报告仍可读）。'
          try { store.emit(runId, { type: 'run.failed' }) } catch {}
        } finally {
          release?.()
        }
        return toolResult(result)
      },
    },
    {
      name: 'mqtt_audit_read_result',
      description: '按 runId 读取已保存的验收结果（内存优先，其次结果目录中的 JSON 文件）。',
      parameters: readResultParameters,
      meta: readMeta,
      async execute({ runId }) {
        if (typeof runId !== 'string' || !/^run-[A-Za-z0-9_-]{1,128}$/.test(runId)) return fail('invalid-run-id', '无效运行标识。')
        if (memoryResults.has(runId)) return toolResult(memoryResults.get(runId))
        const file = path.join(resolvedResults, `${runId}.json`)
        if (!existsSync(file)) return fail('result-not-found', `未找到运行结果: ${runId}`)
        return toolResult(loadJson(file))
      },
    },
    {
      name: 'mqtt_audit_prepare_run',
      description: '提前建立固定验收运行并返回 runId。首次必须全量 c1–c8；复测须提供已结束的 parentRunId，最多两轮。准备阶段不连接 Broker，随后调用 run_check。',
      parameters: prepareParameters,
      meta: runMeta,
      async execute({ caseId, instanceId = 'local-isolated', checkIds, parentRunId }) {
        if (caseId !== 'migration-baseline' || instanceId !== 'local-isolated') return fail('invalid-selection', '仅允许固定本地案例。')
        try { return toolResult({ ...store.prepare({ checkIds, parentRunId }), schema: 'mqtt-permission-audit-run/1' }) }
        catch (error) { return fail('prepare-rejected', error.message) }
      },
    },
    {
      name: 'mqtt_audit_plan_next',
      description: '可选 Jev 建议：仅根据固定案例与本次观测选择查看证据、检查、复测、等待或结束；不执行行动、不判定权限。Agnes 保留最终决定。每个任务最多三次。',
      parameters: readResultParameters,
      meta: { ...runMeta, isOpenWorld: true },
      async execute({ runId }) {
        return toolResult(await planNext({ store, runId }))
      },
    },
  ]
}

export const auditTools = {
  inject: ['extension'],
  apply(ctx) {
    const agnes = ctx.extension()
    for (const tool of buildToolDefs()) {
      agnes.registerTool(tool)
    }
  },
}

export { resolveResultsDirectory }

export const auditDashboardRuntime = {
  apply(ctx) {
    const root = packageRoot()
    const resultsDir = resolveResultsDirectory({ root })
    ctx.services.register(createLatestAuditService(resultsDir))
    for (const service of createProcessServices(resultsDir)) ctx.services.register(service)
    ctx.effect(() => startHealthMonitor({ root, resultsDir }))
  },
}
