# AGH 插件

受控工具适配层（已实现首版并完成本机 AGH 真实会话验收，见 [阶段 3 证据](../../docs/evidence/stage3-agh-plugin-20261007.md)）。

## 包结构

- `mqtt-audit-tools/`：自包含插件包；后端工具/core 零外部依赖，浏览器界面使用 AGH 提供的 React client runtime。manifest 分别注册 `auditTools` 工具行与只读面板服务行，并把 client panel 绑定到服务行。
- 内嵌 `core/` 与 `fixtures/cases/` 为仓库实现的逐字节副本（`tests/plugin/sync.test.mjs` 守护一致性）；修改根目录 core 后必须同步副本。

## 受控工具

| 工具 | 入参 | 行为 |
| --- | --- | --- |
| `mqtt_audit_list_cases` | 无 | 返回案例集 id、说明、检查项与独立期望 |
| `mqtt_audit_run_check` | `caseId`（枚举 pattern）、`instanceId`（枚举 pattern，默认 `local-isolated`） | 调用内嵌 core 对固定本地实例执行双端探针，返回结构化三态结果并落盘（被忽略目录） |
| `mqtt_audit_read_result` | `runId`（字符集受限） | 按运行标识读取内存或已落盘结果 |
| `mqtt_audit_prepare_run` | 固定案例/实例、可选 `parentRunId` 与 c1–c8 范围 | 提前建立 runId；首次全量，最多两轮局部复测；此步不连接 Broker |
| `mqtt_audit_plan_next` | `runId` | 后端显式启用后向固定 Jev 接口询问有限建议；Agnes 决定下一步；默认返回不可用 |

边界：只接受枚举案例 id 与固定实例标识；不提供任意路径、Shell、URL 或模型参数。Jev 是唯一可选的固定建议调用，Key 只从后端环境取得，默认关闭；其余模型调用不开放。`run_check` 非只读、无破坏、封闭世界、不需审批。准备运行的 runId 与追加事件保存在被忽略的结果目录，报告仍为最终结论来源。

当前工作区的合成 Broker 凭据选择顺序为有效的 `MQTT_AUDIT_CREDS`、`.local/reproducible/creds.json`、`.local/env/creds.json`。AGH 运行态须用自身健康快照确认实际选中的环境；2026-10-14 已修复旧目录优先导致面板误报当前 Broker 不可达的问题，见 [实施证据](../../docs/evidence/dashboard-process-20261014.md)。

## 验收结果面板

0.3.0 在以下保留的 0.2.0 外壳和结果页基础上，新增默认“过程”页：两端独立 SVG 拓扑、真实事件增量显示与回放、实时 Broker 健康、复测对比及向当前 AGH 会话提交验收/复测目标。详细状态见 [建设计划](../../docs/plans/dashboard.md) 和 [实施验证](../../docs/evidence/dashboard-process-20261014.md)。历史安装说明中的 0.2.0 数字只表示当时验收过的版本；真实 Agnes 和 Jev 联合验收仍待完成。

`mqtt-audit-tools` 0.2.0 基于官方 MHS 面板外壳改造，注册 `rightbar`、`sidebar.panellist` 和 `shell.overlay`，提供可拖动/折叠右栏、侧栏入口与全屏视图。“概览”显示四个验收维度与报告内 Broker 状态，“对照”展示两端观测及就地展开的证据，“轨迹”只显示当前会话的 MQTT 工具调用。面板只呈现 core 已生成的结果，不重新计算 ACL 结论。上游固定版本、许可证和修改范围见 [来源说明](mqtt-audit-tools/third-party/agnes-harness/README.md)。这是一份官方界面外壳的改造，不启动 MHS/AgnesHub，也不增加设备工具或网络接口。

面板订阅当前 AGH 会话的只读 UI 投影，从该会话最近的 `mqtt_audit_run_check` 工具结果中提取 runId，再用 `mqtt.audit.latestresult` 查询固定结果目录中的报告。查询只接受随机 runId，不接受 sessionId、任意路径或网络目标；CLI 和其他会话的结果不会混入。运行中、错误和无记录状态明确区分。AGH profile 必须允许对应的 client UI 与 `services` 能力。2026-10-13 官方外壳适配版已在隔离 `local-dev` 完成 inspect/update，运行态 trusted/enabled/running，三个新槽位已登记；合成浏览器交互通过。实际 AGH 浏览器停在账户设置引导，真实会话报告与工具轨迹仍待验收。

## 安装与验证

新机器的环境准备、插件本地安装、包内 Skill 与目标句验收见 [部署指南](../../docs/deployment.md)。本包无需额外 MCP 服务。

安装流程、真实会话证据、启停周期与已知局限（CLI 非 TTY 确认限制、status 视图差异、旧插件停用）见 [阶段 3 证据](../../docs/evidence/stage3-agh-plugin-20261007.md)。接入前请核验保留环境中旧插件 `claim-auditor-m0` 的状态；本机验证时已将其停用。

当前交付范围固定在本工作区与隔离 `local-dev` profile，用户已明确不再平移到第二套 AGH；因此跨环境重新安装不属于当前验收项，也不据本机运行缓存声称通用可移植性。
