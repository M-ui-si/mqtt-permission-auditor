# MQTT 验收过程可视化与可选 Jev 小脑建设计划

## 目标与交付范围

在现有 AGH 官方面板适配版内，将抽象网络行为变成可追溯的二维过程图。非专业观众应能说明“谁向谁发起了什么、消息到了哪里、哪里出现问题、为什么得出该结论”；工程人员可在同一画面展开真实事件与报告证据。

固定首版范围为本地 Mosquitto → EMQX、已有合成身份和 c1–c8。保留概览、对照、轨迹，新增默认“过程”页；使用 React、SVG 与 CSS，沿用官方右栏、全屏与窄栏布局。包括验收观测、实时健康监测、历史回放、受控验收/复测请求，以及可选真实 Jev 建议。当前工作区就是最终交付环境。

不包括三维场景、任意目标配置、CPU/内存监控、前端修改 ACL、MHS 设备接入及第二套 AGH 平移。

## 阶段与状态

状态区分代码交付和真实会话验收；代码存在、单元测试通过均不能代替实际模型闭环。以下为本批实施状态，验证记录在文末及 [进度](../progress.md)。

| 阶段 | 交付内容 | 实施状态 | 完成验收标准 |
|---|---|---|---|
| P0 文档整理 | 保留历史依据、明确建设边界与验收项 | 已整理 | 所有新增能力不冒充历史已完成 |
| P1 事件与接口 | 准备运行、追加事件、增量查询、健康监测 | 代码和离线回归通过；Docker 恢复后固定真 Broker 的全量运行、健康采样、停机/恢复与局部复测已直接验证 | 运行中取得 runId；事件可恢复读取；判定回归与真实 Broker 验证通过 |
| P2 图形与回放 | 二维拓扑、节点证据、播放控制、复测对比 | 合成浏览器交互通过；真 Broker 事件的实时/回放状态还原与报告一致；真实 AGH 会话画面待验收 | 同一事件实时与回放状态相同，浏览器交互验证通过 |
| P3 AGH 操作联动 | 当前会话提交验收/复测、隔离与忙碌保护 | `local-dev` 宿主已重启并装载当前插件，健康快照指向正确的固定环境；真实 Agnes 会话提交待验收 | 请求真实进入 Agnes 会话，图形不绕过工具执行链 |
| P4 Jev 可选接入 | 固定建议工具、预算、模式标识、失败降级 | 本地模拟接口、32 KiB 响应上限及降级测试通过；真实 Jev 未调用 | 实际 Jev 返回及后续工具调用可核对；关闭后仍完整可用 |
| P5 当前环境验收 | Broker、Agnes、面板联合演示与脱敏记录 | Broker 与 AGH 插件运行态已验证；Agnes 会话、同次画面和脱敏演示待验收 | 轨迹、事件、报告、图形的 runId 与结论一致 |

## 前端体验与操作计划

```text
MQTT 验收                 Agnes / Agnes + Jev
[过程] [概览] [对照] [轨迹]          [全屏]
实时健康：源端 / 目标端 / 最近采样
运行选择：当前检查 / 阶段 / 完成数量
迁移前 Mosquitto           迁移后 EMQX
发布者 → Broker → 见证者   发布者 → Broker → 见证者
订阅检查额外展示测试订阅者及其请求路径
节点证据 / 主题 / 协议回执 / 确定性判定
[发起验收] [请求复测] [实时/回放] [时间轴]
```

1. 宽屏/全屏两端左右对照，窄栏上下排列；默认跟随当前检查，可切换已有检查。两端分别测试，没有 Mosquitto 向 EMQX 转发消息的含义。角色包括测试身份、Broker、发布者、订阅者、见证者，主题为路径标签。
2. 点击节点展开身份、动作、时间、主题、协议回执、关联标识和事件序号。请求、回执、实际送达、明确拒绝、超时/证据不足用文字、图形与颜色共同区分。PUBACK 只说明发布回执；实际接收才点亮送达路径。SUBACK `0x80` 才是当前主题级拒绝证据。未观测内部 ACL 执行则不绘制规则命中。
3. 实时和回放共用 `process-model.mjs` 的纯状态还原逻辑。支持暂停画面、播放、单步、拖动事件时间轴、0.5×/1×/2×，跳到异常、消息送达、检查结束、复测开始。暂停画面不会暂停实际验收；回放不发 MQTT 请求。图中设备状态来自所选历史事件，顶部健康始终明确标为实时。
4. 旧报告没有日志时显示“无过程记录”，不构造模拟回放。同会话可切换 runId，复测保留 parentRunId，对比同一检查项前后结论。局部复测必须显式标注范围，不能宣称全量通过。
5. 发起验收和请求复测经 `ctx.session.commands.prompt({text})` 交给当前 Agnes 会话，后者携带原 runId 与所选 c1–c8。无会话、会话忙碌、正在提交时禁用；提交前再核对会话。浏览器不连 Broker、不修改 ACL、不调用 Jev。
6. Jev 建议与实际 AGH 工具轨迹分开显示；不存在真实返回时不能显示“已调用 Jev”，后续工具记录也不能自动推断“已采纳”。

## 执行观测、运行与查询计划

- `mqtt_audit_prepare_run` 校验固定案例、检查项及复测来源，先返回随机 runId；准备阶段不启动网络测试。`mqtt_audit_run_check` 可接收此 runId，也兼容原参数自动准备全量运行。初次必须 c1–c8，复测最多两轮。准备记录不可重复执行，本地固定实例有进程级独占锁。
- 核心运行器/探针提供可选事件出口，记录运行/检查生命周期、连接请求及结果、订阅与 SUBACK、发布与 PUBACK、实际收消息、等待结束及确定性判定。runId、递增 seq、时间、checkId、side、role、correlationId 关联整条路径；合成消息关联标识包含唯一 runId，避免旧消息混入新证据。
- 被忽略的运行目录保存 `<runId>.state.json`、`<runId>.events.jsonl`、最终 `<runId>.json`。事件独立追加，复测不覆盖；最终 JSON 仍为结论来源。日志字段白名单不收密码、模型凭据、任意载荷。进程退出后运行状态显示中断，不凭旧记录显示完成。
- 保留 `mqtt.audit.latestresult`，增加 `mqtt.audit.runstatus`、`mqtt.audit.events`、`mqtt.audit.health` 三个只读查询；浏览器使用 AGH 同源服务通道，无通用 WebSocket，无任意路径、地址接口。服务有输入约束、普通文件和大小限制。
- 当前会话准备/执行轨迹确定可选 runId。执行过程每秒请求增量，单批最多 200 条，按 seq 去重；断线恢复接续读取。缺失、冲突或读取中断明确标为观察不完整，不能补成成功轨迹。

## 持续健康监测计划

插件启用且固定配置有效时每 10 秒采样两端，通过独立连接与 `health:` 合成消息做实际送达见证；独立客户端、随机消息关联标识，不进入 c1–c8 审计证据。连接结果与消息往返结果分别显示。采样不重叠，操作有超时，超过 30 秒未更新显示过期；连接失败为不可达而不是 ACL 拒绝。插件生命周期结束时清理定时器并 abort 活跃连接。

配置仍只读取既有本地合成 Broker 凭据。健康快照保存在固定运行目录的 `health.json`，没有 CPU/内存采集。

## 可选 Jev 小脑计划

`mqtt_audit_plan_next({runId})` 是 Agnes 主循环中的受控建议工具，不是独立 Agent 循环。后端从固定案例和结构化观测构建有限选项：关注下一项检查、查看证据、复测指定检查、等待环境恢复、结束并说明剩余未知项。建议中的“关注下一项”不豁免初次全量执行要求。Agnes 决定行动；确定性验证器保留判定权。

- 默认 Agnes 模式；只有后端 `MQTT_AUDIT_JEV_ENABLED=true` 才尝试 Jev；`TYPESAFE_API_KEY` 仅由后端环境提供，不进入前端、工具参数、报告、日志或材料。不要读取/导出既有模型凭据来配置此功能。
- 固定 `POST https://api.typesafe.ai/v1/systemone`，固定 `jev-1.13.0`，记录实际返回版本。依据 [官方接入说明](https://docs.typesafe.ai/introduction/quickstart) 和 [模型说明](https://docs.typesafe.ai/models)。仅发送固定案例、阶段、轮次及裁剪后的三态摘要，不发送完整会话、本机路径、Broker 密码或原始载荷。
- 单次 10 秒，无隐式重试；关闭、缺 Key、超时、失败、非法选项或概率返回均为“建议不可用”，Agnes 继续运行。每个根运行最多 3 次请求，复测最多 2 轮。相同协议证据缺口无环境变化时不反复重试。
- 服务响应最多读取 32 KiB；超限只记录建议不可用，不将响应正文写入事件或报告。
- 记录结构化建议、候选概率、置信度及实际版本；固定文案由本地选项提供，不伪造 Jev 自然语言解释。
- 仅上述固定建议调用是项目约定中的可选例外，其余任意模型调用不开放。比赛允许性待外部规则核实；核实前使用 Agnes 模式演示。无 Jev 模式应完整可用。

## 必须覆盖的验证与待验收项

- [ ] 正常送达与真实见证消息一致；PUBACK 无送达仍 unknown；SUBACK 0x80 显示明确拒绝。
- [ ] Broker 停机/恢复时健康变化；恢复后由真实 Agnes 安排复测。
- [ ] 新旧运行、不同会话、重复执行不串报告或事件；局部复测不伪装全量。
- [ ] 回放暂停、跳转、倍速只影响画面，不触发网络测试或重发。
- [ ] 中途断线、序号缺口、进程退出显示观察不完整/运行中断。
- [ ] Jev 关闭、缺 Key、超时、无效返回均可降级；真实建议与 Agnes 不同选择分别保留。
- [ ] 折叠、全屏、窄屏、停用时正确释放布局、焦点、订阅和监测连接。
- [ ] 当前真实 AGH 会话轨迹、事件、报告和画面四处 runId/结论一致并形成脱敏记录。

完成状态以对应层次的实际验证为准，测试替身不能勾选“真实 Agnes/Jev”验收。

2026-10-14 验证细节：[本批证据与限制](../evidence/dashboard-process-20261014.md)。当日早些时候 Docker Desktop 启动失败；恢复后已在固定真 Broker 上补完健康监测、停机/恢复、全量运行和局部复测。安装态及直接工具测试仍不等于官方 Agnes 模型会话；P3/P5 的会话内 runId 与真实面板画面未据此标为通过。独立回环协议测试覆盖 PUBACK 无送达和 SUBACK 0x80。Jev 保持默认关闭，比赛规则未核准前不用于比赛闭环。

## 历史实现与来源记录（0.2.0，保留）

2026-10-13：插件 0.2.0 已改为基于官方 MHS 面板外壳的 MQTT 适配版，并在隔离 `local-dev` 完成官方 inspect/update，包 trusted/running、无 blocker。通过当前会话工具轨迹选择报告；不启动 MHS/AgnesHub，不增加网络或设备控制工具。真实 Agnes 模型调用与同次报告的闭环仍需另行验收。

## 官方源码基础

来源为 [Agnes Harness](https://github.com/AgnesAI-Labs/agnes-harness/tree/4bc36bc4c4441206388a53bece17379c1d7be14d/packages/mhs/plugin/client)，固定提交 `4bc36bc4c4441206388a53bece17379c1d7be14d`。改造 `hosts/agnes/index.tsx`、`layout/panel.tsx` 与样式中的停靠栏、共享布局状态、侧栏入口、全屏和分页结构；转为当前 AGH 可直接加载的 React 原生 ESM。许可证、原始 NOTICE 与改动声明保存在 [third-party/agnes-harness](../../plugins/agh/mqtt-audit-tools/third-party/agnes-harness/README.md)。这是官方前端外壳的适配，不是原封不动安装设备插件；火星项目和 Three.js 不属于本包。

注册 `rightbar`（priority -1）、`sidebar.panellist`、`shell.overlay` 三个官方槽位。右栏是 single 槽，与其他接管整个右栏的插件不能保证同时显示；安装时应核对槽位竞争，不叠装旧面板。宿主仍使用保留的 `c4efd170…`，无需修改上游源码、升级工具链或读取模型凭据。

设计沿用官方靛蓝交互色、轻点阵背景和圆角卡片；主题由 AGH 变量提供。回退色为背景 #fafafa、文字 #242534、次要文字 #727382、边线 #e1e1e8、交互 #4748b7；状态色只用于确定性结果。正文使用 Segoe UI/Microsoft YaHei，标题 15–18px，正文 13px。内容左对齐，顶部工具条固定，报告内部滚动；对照页用竖向连接线串联检查卡片。没有实时事件就不绘制流量动画。

## 展示内容

- 概览：总体验收结论、四个验收维度、报告时间、业务要求和报告中的 Broker 健康状态（不是实时在线状态）。
- 对照：c1–c8 两端观测、风险筛选与就地证据展开。
- 轨迹：当前会话的案例发现、运行验收、复读结果工具及各自执行状态；不展示原始参数或把完成状态当作验收通过。

面板通过分隔线按钮折叠，侧栏入口可重新展开。分隔线支持拖动以及方向键调整宽度，展开状态、宽度和分页保存在本地存储。全屏支持 Esc 退出、焦点循环和返回触发位置；停用插件清理布局预留、监听及订阅。700px 以下展开为对话下方 48dvh 面板，避免遮挡输入框。

面板只投影 core 报告中的结论与证据，不独立推断 ACL 语义。未知项始终显示为未知；面板不会把连接失败或无送达证据改成拒绝。面板订阅 AGH 当前会话的只读 UI 投影，只从该会话最近一条 MQTT 验收工具轨迹取随机 runId，再经受控查询服务读取对应报告。报告时间缺失或超过 15 分钟时显示“结果已过期”。投影变化时刷新，每 15 秒兜底轮询，也可手动刷新。切换会话重新加载，过时请求不会覆盖新响应；无记录、轨迹不可读、运行中、运行异常各有独立状态。

## 数据与权限边界

浏览器通过 `mqtt.audit.latestresult` 只查询插件生成的随机 `runId`。每次工具运行生成高熵随机 runId 并以此命名报告。服务只读取固定结果目录中的普通文件，核验报告 schema 与 runId，文件上限 512 KiB；拒绝路径、URL 和网络目标。

运行状态来自 AGH 当前会话工具投影，不另建会话存储。CLI 和历史报告不在当前会话轨迹中，面板不会把它们当成本次结果；AGH 投影不可读时明确报错，不伪装成无记录。查询服务不把用户输入当成会话身份字段，遵从宿主参数过滤规则。runId 仅为固定目录中的文件定位符，结果查询仍由 AGH client service 授权控制。浏览器不读取凭据，不写业务数据；仅在本地存储保存布局偏好。

AGH profile 必须允许该插件的 client UI 与 `services` 能力，客户端描述只开放上述一个 query service。本批未修改 capability ceiling；2026-10-13 安装版 capability hash 为 `1324518b617fe5dd1d2f2d6c6b38ad534cec27325fbe220ae5f01b4d5cb10c89`。不要为了面板放宽日常 profile，也不要在插件内绕过服务门控。

## 目标驱动 Skill

插件包自带 [mqtt-migration-audit Skill](../../plugins/agh/mqtt-audit-tools/skills/mqtt-migration-audit.md)。当前 AGH Skills 管理接口显示它为 `trusted / enabled / ready`，且是同名胜出项。用户可只提出“验收本地 Mosquitto 到 EMQX 的 ACL 迁移并解释风险”这一目标；Skill 给 Agnes 提供案例发现、固定实例运行、结果复读、异常处理和三态报告的方法。AGH 对明确提名的可用 Skill 提供确定的预加载路径；仅靠目标语义能否自动选中，仍须新会话实测，不能保证每一次模型规划都会成功。

## 演示流程

1. 在 AGH Web 的“已安装”列表启用 `mqtt-audit-tools` 插件，刷新后打开新会话。
2. 在新会话输入目标“验收本地 Mosquitto 到 EMQX 的 ACL 迁移，说明权限扩大、业务受损、业务要求和无法判定项”。观察 Agnes 是否自主发现 Skill 和调用受控工具；若要确定性加载 Skill，可在请求中明确写“使用 mqtt-migration-audit”。
3. 面板显示同一次运行落盘的报告；需要即时更新时点“刷新结果”。选择 c3 等案例，展示源/目标观测、业务期望和证据详情。
4. 演示 unknown 时明确说明“无法判定”不等于拒绝；模型总结与面板上的确定性结果保持一致。

## 实现位置

- [AGH 包清单](../../plugins/agh/mqtt-audit-tools/package.json) 和 [client 描述](../../plugins/agh/mqtt-audit-tools/extensions/dashboard/agnes.client.json)
- [面板组件](../../plugins/agh/mqtt-audit-tools/extensions/dashboard/client/index.js) 与 [样式](../../plugins/agh/mqtt-audit-tools/extensions/dashboard/client/index.css)
- [官方外壳适配](../../plugins/agh/mqtt-audit-tools/extensions/dashboard/client/official-shell.js) 与 [外壳样式](../../plugins/agh/mqtt-audit-tools/extensions/dashboard/client/official-shell.css)
- [当前会话适配](../../plugins/agh/mqtt-audit-tools/dashboard-session.mjs)
- [只读服务](../../plugins/agh/mqtt-audit-tools/dashboard-service.mjs) 与 [展示模型](../../plugins/agh/mqtt-audit-tools/dashboard-model.mjs)
- [目标驱动 Skill](../../plugins/agh/mqtt-audit-tools/skills/mqtt-migration-audit.md)
