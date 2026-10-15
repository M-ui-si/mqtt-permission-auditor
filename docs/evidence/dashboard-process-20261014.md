# MQTT 过程面板实施与验证记录（2026-10-14）

本记录区分代码、合成浏览器、本地 Broker 与真实模型会话。没有本批真实 Agnes 工具轨迹，也没有真实 Jev 返回；替身和安装状态不作为模型闭环证据。

## 已核实

- 2026-10-13 在已运行的固定本地 `mqtt-audit-reproducible` Mosquitto/EMQX 上，直接经新版受控工具完成全量 c1–c8：`run-78c0f511-1503-4335-bebd-55b6ab23bfa2`。状态 completed，205 条连续事件、8 项结果，16 个双端确定性判定事件与报告逐项一致，无序号缺口。总体 fail；c3 源端 PUBACK 无送达为 unknown，目标端见证送达为 allow，业务要求 fail；14 条实际收消息事件。原始事件和报告只留在被忽略的 `.local/dashboard-validation/`，尚未作为比赛证据导出。
- 首次实机健康监测两端连接成功、往返 unknown。固定 ACL 表明见证账号 `auditor` 只有订阅权限，故将独立监测改为合成设备发布 `telemetry/up`、见证账号接收。修正后合成回环协议测试通过；真实 Docker Broker 尚未复验。
- 2026-10-14 执行保留 Node 24 的 `node --test tests/core/*.test.mjs tests/cli/*.test.mjs tests/plugin/*.test.mjs`：79 pass / 0 fail；健康修正后另跑 `tests/plugin/process.test.mjs`：14 pass / 0 fail。涵盖增量/缺失事件、并发防重、进程中断、回放、会话隔离、Jev 请求预算与降级、临时回环 MQTT 服务器上的送达、静默 PUBACK 和 SUBACK `0x80`。临时服务器不是 Mosquitto/EMQX。
- Edge 隔离临时 profile 打开 `.local/process-preview.html#test`：实际插件组件在合成服务上通过拓扑、unknown/送达、节点证据、暂停/跳转/单步、回放不提交请求、重复提交防护、全屏/Esc、折叠、跨会话迟到响应、停用清理。600px 截图 `.local/process-narrow2.png` 已目视检查上下布局和对比度。网页使用合成数据，不能证明 AGH 会话执行。
- AGH `local-dev` 中插件 0.3.0 经官方 `inspect/update` 后 `trusted=true / desired=enabled / actual=running`、无 blocker。最终安装完整性 `sha256-20a8e2aa22e6fdd68e9d147b3aebf3204587c879ded70a0f5945255146270fb1`，capability hash `9238d68726b419a5aa06df4aeb01eb0f5b6e0a86bf46d9279b7bfe8e49c8124e`。

## 待验收与环境限制

1. 2026-10-14 Docker Desktop 未恢复 Linux Engine 管道，固定 11883/2883 不可达。根据用户建议已执行 `wsl --shutdown` 和 `Restart-Service WSLService`，随后重新启动 Docker；后端仍报 `docker-secrets-engine/engine.sock` 无法改名为 `.stale`。已确认该通信目录仅有一个 0 字节 reparse-point socket，Docker 进程停止且管理员令牌具备目录权限后，保留式 `Rename-Item` 仍返回 Access denied；未删除、重置或修改 Docker 数据。健康探针修正后的真 Broker 往返、停机/恢复场景因此待验收。
2. AGH Web 打开模型账户设置引导，没有新的真实 Agnes 会话。需要在真实会话中看到 `prepare_run → run_check → read_result` 轨迹与同一 runId 的过程/报告图后，才能验收 P3/P5。没有读取、配置或导出模型凭据。
3. 未配置或调用真实 TypeSafe Jev。固定请求模板、模拟结构化返回、缺 Key/超时/非法响应降级已测试；实际版本、建议与 Agnes 后续行动关系待核对。比赛规则未核准前默认关闭 Jev。

源码在 `core/`、`plugins/agh/mqtt-audit-tools/`；测试在 `tests/plugin/`。运行数据和截图在被忽略的 `.local/`。未触及 AGH 上游源码、模型凭据、真实目标或无关 Docker 容器；未提交或发布。

## 同日非 Docker 补充验证

- 健康采样改为分别处理两端：一侧探针意外抛错时，另一侧成功连接和消息见证仍写入快照；异常侧为未知，不伪造不可达或 ACL 拒绝。新增替身测试覆盖双端分歧；真实 Mosquitto/EMQX 仍未复验。
- 固定 Jev 请求的响应设 32 KiB 读取上限；超限降级，不记录服务正文。新增合成大响应测试。没有调用真实 TypeSafe 服务。
- 使用保留 Node 24.19.0 运行 `node --test tests/core/*.test.mjs tests/cli/*.test.mjs tests/plugin/*.test.mjs` → **81 pass / 0 fail**；`git diff --check` → 通过，仅存量换行提示。
- 当前 AGH 管理 context 确认为 `local-dev`；官方 inspect/update 后插件 `trusted=true / desired=enabled / actual=running`、无 blocker，active integrity 与检查结果一致：`sha256-61389ac8d96545362f5f4d6f969697066b6d24c99c7c5591b1460fff7f9f51bf`。上述较早的 0.3.0 integrity 是本次更新前安装记录。

## Docker 恢复后的固定 Broker 复验（2026-10-14）

本节更新上文“Docker 尚未恢复”的当时状态。经 Docker Linux Engine 命名管道只读查询，版本为 29.8.2；只启动项目 `mqtt-audit-reproducible` 下已存在、端口分别仅绑定 `127.0.0.1:11883` 与 `127.0.0.1:2883` 的 Mosquitto/EMQX 容器。其他容器和 Docker 数据盘未操作。`node cli/environment.mjs check --name reproducible` 两端均返回 `witness-received-message`。

- 新版健康探针对真 Broker 首次采样：两端 `connection=connected`、`roundtrip=received`、`stale=false`。受控停止目标 EMQX 后：源端仍为 connected/received，目标端为 unreachable/unknown；恢复 EMQX 后两端回到 connected/received。不可达没有被当作主题 ACL 拒绝。
- 直接调用受控工具 `prepare_run → run_check` 执行全量 c1–c8：`run-01146023-c9f4-4f57-a571-d0d159070e47`，状态 completed，205 条连续事件、16 条双端判定与最终报告逐项一致，无观察缺口。总体 fail；c3 源端 unknown、目标端 allow，目标端违反业务要求。
- 目标恢复后直接准备 c3 局部复测：`run-d822bc49-cf86-488b-be57-369cccf49d36`，`parentRunId` 指向上述全量运行，`round=1`、`coverage=partial`，27 条连续事件，c3 源端 unknown、目标端 allow，总体 fail。两次运行的同一事件集合在实时与完整回放状态还原中一致，且观测与报告相同。局部复测不代表全量通过；这一步由直接工具调用执行，**不是 Agnes 安排复测的证据**。
- 启动隔离 AGH `local-dev` 后，管理 context 与 Web HTTP 200 可读。发现安装版健康采样写到旧 `.local/env/agh-runs`，并对当前运行的 `reproducible` Broker 报不可达；其原因是实际选择了旧环境的合成账号。插件候选路径改为显式 `MQTT_AUDIT_CREDS` 优先，其次固定 `.local/reproducible`，最后 `.local/env`。重装后 AGH 自身写入的 `.local/reproducible/agh-runs/health.json` 为两端 connected/received、未过期；旧目录的 `monitoring=false` 且状态过期，不再冒充实时数据。插件 `trusted/enabled/running`、无 blocker，最终 integrity 与测试结果见 [进度](../progress.md)。未读取或输出合成账号内容。
- 发现重复事件序号内容冲突时，回放现在标记观察不完整并保留首次事件，防止冲突覆盖成伪造的送达；健康监测停止时将快照标为 `monitoring=false`，查询立即显示过期，界面不再展示旧健康为当前成功。

最终安装版本的 integrity 为 `sha256-5d324abaf00245865737db6de7ccdf86c122846624ca3c4cc47fcff1f2cdc497`，capability hash 未变；全量离线回归为 82 pass / 0 fail。TypeSafe [官方接入说明](https://docs.typesafe.ai/introduction/quickstart) 与 [模型列表](https://docs.typesafe.ai/models) 仍列出固定 systemone 接口与 `jev-1.13.0`；此项只是文档核对，不是实际服务调用。

仍待真实 AGH 会话内由官方 Agnes 模型发起 `prepare_run → run_check → read_result`，核对同一 runId 的会话轨迹和真实面板画面。用户表示官方 Agnes 账户已启用，但当前隔离 `AGH_HOME` / `local-dev` 的官方 CLI 返回 `PROVIDER_UNCONFIGURED`；未显式 data-dir 的 `agh daemon status` 与 Web 所连的是同一运行中 daemon，`agh doctor provider --json`（无 `--probe`）返回 `no configured provider route selected`。本地 4181 实例须先有官方 Agnes 模型路由；未读取模型 Key 或 WebSocket 令牌。Web HTTP 200、插件 running、直接工具执行和本地事件回放均不能替代模型证据。Jev 仍默认关闭、未进行实际服务调用；比赛规则允许性仍待核实。原始报告与事件仅留在被忽略的 `.local/reproducible/agh-runs`，未作为提交材料导出。

## 真实 Agnes 会话闭环与面板验收（2026-10-14 傍晚）

上节的 `PROVIDER_UNCONFIGURED` 阻塞已解除：用户在 `http://127.0.0.1:4181/` 设置中启用了官方 Agnes 账户后，同一隔离 `local-dev` 内产生了真实模型会话。本节为该会话的验收记录。

### 会话与轨迹（官方导出复核）

- 会话 `agnes:local:local-dev:cli:workspace:4c22e06ea4d4b0af`（2026-10-14T09:08:14.798Z 创建，preset standard，cwd `<项目工作区>`），模型 `agnes-3.0-flash`，两轮回复均 Completed。
- 逐行解析官方导出 `agh-live-export-20261014-final.json`（155 行、lastSeq 155）：共 6 次 `tool/call`，两轮各按 `mqtt_audit_prepare_run → mqtt_audit_run_check → mqtt_audit_read_result` 顺序执行；每轮内三个工具使用同一 runId，导出中无 MQTT 工具错误。时间戳与 `.local/reproducible/agh-runs` 落盘文件一致。
- 全量运行 `run-5f97074f-2a9f-4f9e-9392-06964ee16a03`：round 0、scope full、c1–c8、205 条连续事件、状态 completed；passCount 4/8、overall fail、`requirementFailures=[{c3,target}]`、unknowns 6 项。
- 局部复测 `run-da69e187-baeb-4bc3-a04f-1c1e412d849f`：`parentRunId`/`rootRunId` 指向全量运行，`checkIds=[c3]`、round 1、scope partial、27 条连续事件；c3 判定与原轮一致（目标端 allow/requirement fail，源端 unknown），总体 fail。模型回答明确"局部复测不能证明 c1–c8 全量通过"，与工具结构化返回一致。
- 模型两轮回答文本留存于 `.local/agh-live-20261014.json`（lastSeq 78）与 `.local/agh-live-retest-20261014.json`（lastSeq 155）。

### 面板取数与实际画面（真实浏览器）

- 在 ZCode 内置浏览器打开 `http://127.0.0.1:4181/?session=<该会话>`：右栏 `mpa-shell` 实际挂载渲染，运行选择器列出本会话两个 runId；全量视图 205/205 条事件、8/8 检查、completed，复测视图 27/27 条、`coverage=partial` 标注"局部复测：c3，不代表全量验收通过"；事件明细（seq 6–10 等）的 runId/checkId/correlationId 与运行数据一致；实时健康两端 connected/received（采样 17:44–17:52 区间实测），并标注"独立监测，不计入审计结论"。
- 画面截图存档 `.local/agh-live-panel-20261014-full.png` 与 `.local/agh-live-panel-20261014-retest.png`（1280×720）。视觉核验提出"右侧文字可能截断"的疑点后，用 DOM 度量复核：面板内无文本元素超出面板边界、无重叠；唯一横向溢出为折叠边签装饰箭头 `›`（字形 24px、按钮 11px），属外观小节。小字号在 1280×720 + 360px 面板宽度下可读性有限；面板支持拖宽/全屏/折叠。
- 上个会话的 Edge headless 截图当时只产出 0 字节文件（`agh-live-panel-20261014.png` 未生成）；本批以内置浏览器完成替代验收。

### 发现并修复：截断批次误标"观察不完整"且前端锁存

- 现象：切换到 205 条事件的全量运行后，事件计数已达 205/205、运行 completed，面板仍常驻"观察不完整或运行中断"警告。
- 根因（两层）：`run-store.mjs` 的 `events()` 在批次被 limit 截断（`break outer`）后仍把残留 pending 当作"尾部不完整追加"，返回 `incomplete=true`；前端 `process.js` 用 `incomplete ||= batch.incomplete` 只置真不复位，把该瞬态永久锁存。用真实 store 复现：修复前 poll1（200 条）`incomplete=true`。
- 修复：`events()` 区分截断（由 `hasMore` 表达）与尾部半行，仅后者标 incomplete；前端每轮重算 `incomplete = merged.incomplete || batch.incomplete`，并按 `hasMore` 在同一轮内连续拉取（含卡死游标保护）。
- 测试：`tests/plugin/process.test.mjs` 增加截断批次 `incomplete=false`、续批后合并完整、小运行尾部半行仍报 incomplete 的断言。保留 Node 24.21.0 全量回归 `node --test tests/core/*.test.mjs tests/cli/*.test.mjs tests/plugin/*.test.mjs` → **82 pass / 0 fail**；`node --check` 两处改动文件通过；修复后真实 store 复验 poll1/poll2 均 `incomplete=false`。
- 重装：`.local/update-panel.ps1` 官方 inspect/update 后 `trusted=true / desired=enabled / actual=running`、无 blocker，最终 integrity `sha256-d2e6e8fd2cad4edd2cd0af3bbfcb68e729783decea29039b3d6428b2619940b8`，capability hash 仍为 `9238d68726b419a5aa06df4aeb01eb0f5b6e0a86bf46d9279b7bfe8e49c8124e`。重装后真实浏览器复验：全量 205/205 与复测 27/27 视图警告均消失。

### 边界说明

本批浏览器只访问本机 `127.0.0.1:4181`，未读取或修改模型凭据、未在会话中提交新 prompt（仅切换面板运行选择器）。两轮模型会话与面板验收已闭环；Jev 仍默认关闭且未调用；比赛演示视频与提交材料仍未完成。
