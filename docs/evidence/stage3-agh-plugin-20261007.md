# 阶段 3 记录：AGH 插件接入与真实会话验收（2026-10-07）

> **语义修订标注（2026-10-07 审查后续批次）**：本页会话（run-…d27bb3）的工具结果由当时的 core 判定语义产生（"收到 PUBACK 但未送达 = 拒绝"）。现行语义已改为发布未送达一律"无法判定"（详见 [架构](../architecture.md) 与 [core/prober.mjs](../../core/prober.mjs)）。本页保留为**历史事实**：安装/启用/工具调用/Trace/落盘等接入证据不受语义修订影响；其中依赖旧语义的分类结论（c3 源端"拒绝"、c2/c8"拒绝"）尚待新语义下重跑确认。另：AGH 已安装的插件快照仍是修复前版本，重新安装后才会以新语义运行。

按 [研发计划](../plans/development-plan.md) 阶段 3 交付：受控工具插件已在保留 AGH 环境（本地 daemon，`agnes-3.0-flash`）完成安装、启用、**真实会话工具调用闭环**与启停周期验证。原始会话数据保留在被忽略的 AGH home；本页只记录脱敏事实。

## 交付物

| 位置 | 内容 |
| --- | --- |
| `plugins/agh/mqtt-audit-tools/` | 自包含插件包（manifest `agnes.plugins`、TypeBox 参数、零外部依赖）：`index.mjs` + `core/`（core 四模块副本）+ `fixtures/cases/`（案例副本）+ `instances.json`（唯一固定实例 `local-isolated`） |
| 三个受控工具 | `mqtt_audit_list_cases`（只读）、`mqtt_audit_run_check`（写结果文件，非破坏）、`mqtt_audit_read_result`（只读） |
| 输入约束 | `caseId`/`instanceId` 以 TypeBox `pattern` 锁定枚举值；`runId` 限字符集与长度；`additionalProperties: false`；不接受任意路径、Shell、URL 或模型参数；不持有模型 Key |
| 凭据解析 | 仅按固定候选路径读取被忽略的 `.local/env/creds.json`（或环境变量 `MQTT_AUDIT_CREDS`），缺失时返回结构化错误 |
| 测试 | `tests/plugin/tools.test.mjs`（6 项：注入假 runner、错误路径、schema 锁定）+ `tests/plugin/sync.test.mjs`（副本逐字节一致） |

## 包审核事实

- `package inspect`：`mqtt-audit-tools@0.1.0`，integrity `sha256-ba9a7c6e…25e9e`；与上游示例包输出形态一致（`contributions none` 为 inspect 阶段正常形态）。
- Web"从来源安装"预览给出 capability summary hash `e3de4e5f…22b01`；启用确认框绑定同一对摘要后激活。

## 真实会话证据（验收核心）

会话 `6883bbd1-1efd-4271-9160-d94c1a155e6e`（AGH Web，模型 `agnes-3.0-flash`，工作区 `<项目工作区>`，52 秒完成）：

1. Trace 工具事件（真实调用，非自然语言复述）：
   - `mqtt_audit_list_cases {}` → 11 毫秒，返回 `{"schema":"mqtt-permission-audit-tool/1","status":"ok","cases":[…]}`（8 检查与期望全量）。
   - `mqtt_audit_run_check {"caseId":"migration-baseline"}` → 30 秒，返回 `{"schema":"mqtt-permission-audit/1","generatedAt":"2026-10-07T11:50:16.006Z",…}`。
2. 结构化结果落盘：`.local/env/agh-runs/run-2026-10-07T11-50-16-006Z-d27bb3.json`（插件自身写入），其结论与阶段 2 CLI 的 naive 档案运行一致：`overall=fail`、`c3` 权限扩大（目标端送达 `factory/admin/secret`）、其余 7 项通过、无未知项、两端健康。
3. 模型基于结构化返回作出的三态总结忠实于数据（7/8 通过、c3 失败+权限扩大、无无法判定），未凭空给出验收结论。

宿主审计日志（`data/audit/host.jsonl`）对应记录：三次 `extension.registered`（三工具）+ `extension.loaded`（11:44:45 首次启用、11:48:59 daemon 重启自动加载、11:52:45 停用后再启用）。

## 启用/停用周期

Web 插件管理完成 install → enable → **disable（开关撤下，"Disable: Completed"）→ 再 enable** 全周期；停用后开关回到未启用态，再启用后恢复 checked 并重新注册三工具。

## 过程事实与局限（如实记录）

- CLI `package add` 的交互确认在非 TTY 下强制拒绝（`confirmPackageInstall` 要求 stdin/stdout 均为 TTY），管道输入 `y` 无效；故走官方 Web"从来源安装"流程（同为文档认可路径）。
- CLI `package status` 只列三个官方助手，与 Web 已装列表（含停用的 `claim-auditor-m0@0.3.0` 与启用的 `mqtt-audit-tools`）不一致；以 Web 状态 + 宿主审计日志为准。
- `doctor extensions` 报 `extension host assembly failed`，与宿主日志中三工具成功注册/加载矛盾，未定位原因；该检查的失败不否定运行时证据，但按规则如实记录为未解事实。
- 旧插件 `claim-auditor-m0` 实际仍在保留环境且此前为启用态；本批次已在 Web 中**停用**（保留未删除），排除旧工具干扰。
- CLI 一次性会话（`-p`）报 `PROVIDER_UNCONFIGURED`（CLI 作用域未配模型）；模型闭环使用 Web 会话的 Agnes 账户完成。
- 承载 daemon 的后台进程在本批次中途被终止过一次，重启后插件自动恢复加载（持久启用的意外实证）；daemon 生命周期与发起会话绑定，需按 [环境版本记录](../environment-versions.md) 的命令重启。

## 复现要点

```sh
# 1. 启动 daemon（保留 home；见 docs/deployment.md 参考）
# 2. 启动本地 Broker（naive 档案）
cd .local/env && sh stage2/use-acl.sh naive
# 3. AGH Web → 设置 → 插件管理 → 从来源安装 file:./plugins/agh/mqtt-audit-tools → 检查/安装/启用
# 4. 新会话要求模型调用 mqtt_audit_list_cases 与 mqtt_audit_run_check(caseId=migration-baseline)
# 5. 结果落盘 .local/env/agh-runs/<runId>.json；Trace 页签查看工具事件
```

第二套 AGH 的重新安装与验证属阶段 5，本页证据不替代该流程。
