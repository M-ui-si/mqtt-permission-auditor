# 进度与交接

更新日期：2026-10-15。

## MQTT 权限迁移审计器本地界面一键启动器（2026-10-15）

任务：按用户澄清，提供双击启动 AGH Web 界面的 EXE，显示本地网址并打开浏览器。
负责人：本次执行助手。
修改目录：根目录新增 `agh_launcher.py`、`build-agh-launcher.ps1`、`MQTT权限迁移审计器.exe`；更新 `README.md`、`运行说明.md`、`docs/README.md`；新增 AGH 启动证据页。桌面窗口和可执行文件已改用项目名称“MQTT 权限迁移审计器”。此前误做的 MQTT 审计器启动器及其源码/证据已删除。
已完成：启动器定位本机/包内 Agnes Harness 与 Node.js 24.10+，使用包内隔离 `.local/agh-local-dev` 配置，启动 `serve` 并输出/打开 URL；检测到 4180–4190 已有 AGH 页面时复用网址。当前项目界面已在 `http://127.0.0.1:4180/` 运行。
验证命令与结果：PyInstaller 6.19.0 / Python 3.14.6 构建 `MQTT权限迁移审计器.exe` 成功；双击后自动启动 AGH 上游固定提交 `c4efd170547a225890664c1c186a7347399b53e0` + Node v24.21.0；`Invoke-WebRequest http://127.0.0.1:4180/` 返回 HTTP 200，页面标题 `Agnes Harness`。启动窗口显示项目名称并提供本地网址。
未完成/风险：本包不包含 AGH 上游源码、Node.js 或模型 Key；其他机器需先取得固定版本 AGH 构建产物并安装 Node.js 24.10+。本机新隔离 home 的模型路由尚未配置。
下一步：双击根目录 `MQTT权限迁移审计器.exe` 即可启动界面；端口自动选取 4180–4190 空闲项。

## 通俗版视频与云希男声制作（2026-10-15）

任务：用户确认通俗台本，指定 tts.wangwangit.com 的云希男声后要求继续制作。
负责人：本次执行助手。
修改目录：被忽略的 `.local/demo-video/v2/` 与制作脚本；`docs/提交材料/演示视频台本-通俗版.md`、`docs/evidence/demo-video-v2-20261015.md`、原 v1 证据页、`docs/competition-submission.md`、`docs/README.md`、本页。
跨目录修改原因：成片版本、台本状态、证据与提交材料需同步；未修改核心、插件、上游代码、模型凭据或运行环境。
已完成：通过用户指定网站生成 43 句云希男声，General / 1.0 倍速 / 0 Hz；按批准台本重剪三个真实独立 AGH 会话，加入通俗解释卡与关键证据放大；58 条中文字幕，270.68 秒、1080p、25 fps、H.264/AAC。修正定格帧字幕不更新问题，按 25 fps 补帧后烧录字幕；旧 v1 保留。交付目录 `.local/demo-video/v2/deliverables/`，详见 [v2 制作记录](evidence/demo-video-v2-20261015.md)。
验证命令与结果：`python .local/demo-video/synthesize_v2.py` → 43 句成功；`python .local/demo-video/build_v2.py` 与 `finalize_v2.py` → 成片生成；`python .local/demo-video/verify_v2.py` → 完整解码错误 0、配音输入/字幕与批准台本逐字一致、证据摘要与 v1 一致；22 场景抽帧总览及关键画面检查。新视频 SHA-256 `01d39dd893410d2bc6a5e3a2166a435630e89dc5dac26eb7e313f070395c3696`。
未完成/风险：未做人工听感或语音转写审核；长句内部字幕为按文字占比分配，未做音素级对齐。正常仅 c1 通过，配置未修复，其他原始证据边界不变。视频未上传或代提交。
阻塞原因：无制作阻塞。
下一步：用户审阅新成片，后续提交按最终清单处理。

## 演示台本通俗化文字改稿（2026-10-14，接视频审阅反馈）

任务：用户反馈旧片对非行业观众难以理解，要求先重写文字，讲清楚要求、实际执行、可观察的判断及最终结果。
负责人：本次执行助手。
修改目录：`docs/提交材料/演示视频台本-通俗版.md`、`docs/README.md`、本页。
跨目录修改原因：只涉及文档；新台本需纳入导航和交接。
已完成：按“为什么检查 → 失败会话 → 停机边界 → 恢复后的正常会话 → 结果解释”写成可口播稿，每个会话均含要求、实际动作、结果和画面重点。核对本次三个官方导出的工具顺序与既有报告，保留两处真实交互细节：目标端失败不直接推断权限扩大；用户追问后才回读全量报告并复测。明确人工停机/恢复、复测未改配置、正常仅 c1 通过，不添加模型内心独白或未发生的自主行动。
验证命令与结果：读取 `.local/demo-video/{failure,boundary,normal}-export.json` 的公开回答与 tool/call 记录，与实录证据和台本核对；`.tools/node24/node.exe .local/link-check.mjs .` → 36 文件、190 相对链接、缺失 0；已跟踪文档 `git diff --check` 与新稿逐行空白检查通过，仅存量 LF/CRLF 提示。
未完成/风险：本次仅为文字审阅稿，朗读预算约 4 分 30 秒至 5 分钟，尚未实测新版配音时长或重剪视频；旧视频及旧配音稿仍对应 v1。
阻塞原因：无文字编写阻塞。
下一步：根据用户对文字版的反馈定稿，再制作对应画面、字幕和配音。

## 三类样例独立会话视频实录（2026-10-14 夜）

任务：按用户要求直接完成演示视频，中文字幕＋电脑合成配音，正常、边界、失败三类分别使用独立会话窗口。
负责人：本次执行助手。
修改目录：被忽略的 `.local/demo-video/`（浏览器实录、官方导出、剪辑与配音脚本、成片及配套文件）；`docs/evidence/demo-video-20261014.md`、`docs/competition-submission.md`、`docs/README.md`、本页。
跨目录修改原因：视频结论需与实际会话、运行报告及提交材料一致；未修改插件、核心、上游源码、系统配置或模型凭据。
已完成：三个独立 AGH 会话实际录制，官方 Agnes 共 15 次工具调用（14 次 MQTT、1 次 Skill）、均有非错误返回。失败全量/c3 复测 205/27 事件、fail；目标 EMQX 受控停机边界 124 事件、全量 unknown；恢复后正常 c1 27 事件、partial/pass。目标已恢复，双端送达检查通过。已生成 4 分 30 秒、1920×1080、25 fps、H.264/AAC 的中文字幕＋本机中文合成配音成片，位于 `.local/demo-video/deliverables/MQTT三类样例演示.mp4`，并附 SRT、WAV、证据摘要和验证结果。详见[实录证据](evidence/demo-video-20261014.md)。
验证命令与结果：官方 `agnes.mjs export` 三个会话成功；`python .local/demo-video/verify.py` → 会话/调用/四次运行及父子关系、范围、结论、事件连续性一致，270.0 秒、1920×1080、25 fps、完整解码错误 0；成片抽帧及四处关键帧人工检查通过；`node cli/environment.mjs check --name reproducible` → 恢复后及录制结束均双端 witness-received-message。媒体制作未修改代码逻辑，未重复无关测试。
未完成/风险：正常片段仅验证 c1，不代表全量迁移通过；正常会话的 parent 指向边界会话，面板不能直接展示跨会话前后差异，工具报告关联已核验；视频已生成但未上传、发布或代提交。原始会话/浏览器配置仅留忽略目录。
阻塞原因：无录制技术阻塞。
下一步：用户审阅成片；按比赛要求提交视频及选定证据，公开仓库与成员信息仍按提交清单处理。

## 提交材料表单拆分文件（2026-10-14 晚）

任务：按用户要求新建文件夹，将提交材料的"基本信息 / 技术信息 / 成员声明"拆为三个中文命名 Markdown 文件。
负责人：本次执行助手。
修改目录：新增 `docs/提交材料/`（`基本信息.md`、`技术信息.md`、`成员声明.md`）；`docs/competition-submission.md`（用途段补一行双向指引）；`docs/README.md`（比赛材料组补三个链接）；本页。
跨目录修改原因：无代码目录改动；主文档与导航需指向新拆分文件，避免内容孤立。
已完成：三个拆分文件内容照抄主文档第 1、2、7 节原文（项目名称/参考方向/摘要/问题目标；AGH 作用/Agnes 模型表/数据代码环境接口表；成员声明模板），仅"佐证材料"行的"第 5 节"改为指向主文档的链接，未改动任何事实数字与 `【回填】` 标记；每个文件头部注明拆分来源与"两处同步"约定。
验证命令与结果：`.tools/node24/node.exe .local/link-check.mjs .` → 34 个 Markdown 文件、185 条相对链接、缺失 0（新增 3 文件及其入链全部有效）；`git -c safe.directory=D:/AGH diff --check` → 通过，仅存量 LF/CRLF 提示。
未完成/风险：拆分文件与主文档第 1、2、7 节为受控重复，后续修改必须两处同步；成员声明个人信息仍由团队填写。
阻塞原因：无。
下一步：录制演示视频、按第 3.2/8 节发布仓库并回填链接与日期、按第 9 节清单提交。

## docs 目录整理与结构分组（2026-10-14 晚）

任务：按用户要求整理 `docs/` 目录内容，比赛提交材料保持独立成文的单个文件。
负责人：本次执行助手。
修改目录：`docs/`（新增 `plans/` 子目录并移入四份计划文档；重写 `docs/README.md` 为分组导航；本页旧条目中的 Markdown 链接路径同步）；另同步三处指向被移动文件的链接：`AGENTS.md`（面板计划）、`plugins/agh/README.md`（建设计划）、`docs/evidence/stage2-core-cli-20261007.md` 与 `stage3-agh-plugin-20261007.md`（研发计划，仅链接路径，历史内容不改写）。
跨目录修改原因：文件移动后所有指向旧路径的链接必须同步，否则导航与历史证据中的链接失效；未改动任何文档的事实内容。
已完成：`development-plan.md`、`environment-setup-plan.md`、`improvement-plan.md`、`dashboard.md` 四份计划/过程类文档移入 `docs/plans/`，docs 根目录由 13 个文件收敛为 9 个；`docs/README.md` 导航按"项目说明 / 比赛材料 / 计划与过程 / 证据"分组，并补挂此前未列入导航的 `evidence/deployment-20261009.md` 与 `evidence/dashboard-process-20261014.md`；比赛提交材料维持独立文件 `docs/competition-submission.md`（表单文字、视频分镜与提示词、证据附件与脱敏清单均在其中），在导航"比赛材料"组置顶。被移动文件内部链接（指向 docs 根、evidence/ 与仓库根目录的相对路径）已全部加前缀修正。
验证命令与结果：新增 `.local/link-check.mjs`（被忽略目录内的本地检查脚本），`.tools/node24/node.exe .local/link-check.mjs .` → 31 个 Markdown 文件、175 条相对链接、缺失 0；`git -c safe.directory=D:/AGH status --short` → 改动仅限上述文件与 `docs/plans/`（未提交，按规则不自动提交）；`git -c safe.directory=D:/AGH diff --check` → 通过，仅存量 LF/CRLF 提示。
未完成/风险：本页历史批次文本中反引号包裹的旧路径（如 `docs/dashboard.md`）按"历史记录保留原文"原则未改写，实际位置已变为 `docs/plans/`；根 `README.md` 状态行仍早于 2026-10-14 真实会话验收（表述为"真实会话尚未完成"），与本页及 AGENTS 不一致，属状态口径问题，本批只做结构整理未改其内容。
阻塞原因：无。
下一步：录制演示视频、按提交材料第 3.2/8 节发布仓库并回填链接、按第 9 节清单提交；如需同步根 README 状态行，由状态文档负责批次单独处理。

## 比赛提交材料整理（2026-10-14 晚）

任务：按主办方提交表单逐项写好文字材料、演示视频分镜与提示词、证据附件与脱敏清单。
负责人：本次执行助手。
修改目录：新增 `docs/competition-submission.md`；更新 `docs/README.md`、`docs/competition.md` 与本页。无代码改动。
跨目录修改原因：提交材料需引用最新验收事实（真实会话闭环、面板画面、82/82 测试），导航与备忘需同步指向。
已完成：提交材料按表单八项成文——基本信息（名称/方向建议/摘要/问题目标，均为可直接粘贴稿）、技术信息（AGH 作用、agnes-3.0-flash 环节与调用方式、镜像摘要与端口 11883/2883 等事实表）、可运行作品（在线链接口径、仓库发布清单含排除 `.local`/`vendor`、精简复现步骤）、演示视频 4 分 30 秒分镜与双版本提示词（口语版 A/B/C 推荐用于视频，展示模型自主规划与 Skill 触发并附容错追问；精确版 A'/B' 为 2026-10-14 真实会话留档原文，其中 B' 需替换实际 runId）、运行证据四项附件映射（官方导出/6 次调用链/模型回答/配置与验证结果）、正常边界失败三类测试样例表、成员声明模板、公开内容方案（GitHub 仓库 + README 模板）与脱敏检查、提交前最终清单（截止 2026-10-15 12:00）。
验证命令与结果：核对 `instances.json`（源 11883/目标 2883，纠正模型回答中 28883 笔误不采信）、`environment-versions.md` 镜像摘要、`package.json`、`agh --version`（agh 0.0.0 node 24.21.0 protocol _agnes/v1）、插件 0.3.0 与 Skill 描述；`git diff --check` 通过（仅存量换行提示）；文档本地链接检查通过。
未完成/风险：仓库与公开内容尚未发布（材料中留 `【回填】`），演示视频未录制；成员声明个人信息由团队填写；参考方向需对照官方列表勾选。
阻塞原因：按协作规则不自动创建远程仓库或发布；其余无阻塞。
下一步：按材料第 3.2/8 节发布仓库并回填链接与日期；按第 4 节录制视频（新会话 + 替换 runId）；按第 9 节清单提交。

## 真实 Agnes 会话闭环与面板修复验收（2026-10-14 傍晚）

任务：接续上一会话（因用量中断）未竟的两项：核对真实会话在右栏面板的显示数据与实际画面，并收尾 c3 局部复测核对。
负责人：本次执行助手。
修改目录：`plugins/agh/mqtt-audit-tools/run-store.mjs`、`plugins/agh/mqtt-audit-tools/extensions/dashboard/client/process.js`、`tests/plugin/process.test.mjs`、`docs/`；被忽略的 `.local/` 留存导出轨迹、截图与本会话核验产物。
跨目录修改原因：真实浏览器验收发现"观察不完整"警告在 205 条事件齐全、运行 completed 后仍常驻，属跨后端标记与前端状态锁存的两层缺陷，需同步修复、测试与重装。未修改 AGH 上游源码、模型凭据或 Docker 数据。
已完成：用户启用官方 Agnes 账户后，会话 `agnes:local:local-dev:cli:workspace:4c22e06ea4d4b0af`（agnes-3.0-flash）已完成两轮闭环。逐行复核官方导出 `agh-live-export-20261014-final.json`（155 行）：两轮各按 `prepare_run → run_check → read_result` 执行、每轮同一 runId、无 MQTT 工具错误；全量 `run-5f97074f`（205 事件，fail，requirementFailures=[c3 target]）与局部复测 `run-da69e187`（parent 关联正确、27 事件、c3 判定不变、partial 不冒充全量）均与落盘报告一致，模型回答留档 `.local/agh-live-20261014.json` 与 `.local/agh-live-retest-20261014.json`——上个会话遗留的"等 Agnes 读完结果后核对复测"已完成。真实浏览器打开该会话：右栏面板列出两个 runId，全量 205/205、复测 27/27、实时健康两端 connected/received，事件明细 runId 一致；截图存档 `.local/agh-live-panel-20261014-full.png`、`-retest.png`，DOM 度量无文字截断/重叠（仅折叠边签装饰箭头字形略宽于按钮，外观小节）。验收中发现并修复截断批次误标 incomplete + 前端锁存警告缺陷（详见 [证据](evidence/dashboard-process-20261014.md)），重装后两视图警告消失。
验证命令与结果：逐行解析官方导出（6 次 tool/call 顺序与 runId 核对）→ 通过；`node --input-type=module` 用真实 store 模拟两轮轮询 → 修复前 poll1 `incomplete=true`，修复后均为 false；保留 Node 24.21.0 `node --test tests/core/*.test.mjs tests/cli/*.test.mjs tests/plugin/*.test.mjs` → **82 pass / 0 fail**；`node --check` 两处改动文件 → 通过；`.local/update-panel.ps1` → trusted/running、无 blocker，integrity `sha256-d2e6e8fd2cad4edd2cd0af3bbfcb68e729783decea29039b3d6428b2619940b8`（capability hash 不变）；浏览器复验 205/205 与 27/27 无警告。
未完成/风险：真实会话、面板显示与画面验收已闭环，但比赛演示视频与提交材料未开始；Jev 默认关闭，真实返回与比赛允许性仍未验收；1280×720 窄视口小字号可读性有限（面板可拖宽/全屏）。
阻塞原因：无技术阻塞；演示材料待安排。
下一步：录制比赛演示视频（可用同一会话与面板画面），整理脱敏提交材料；规则明确后再决定是否启用 Jev 验收。

## Docker 恢复后的计划续做（2026-10-14）

任务：继续实施 [过程面板与可选 Jev 计划](plans/dashboard.md)，补齐真 Broker、AGH 宿主健康监测和事件/报告复验。
负责人：本次执行助手。
修改目录：`plugins/agh/mqtt-audit-tools/`、`tests/plugin/`、`docs/`；被忽略的 `.local/reproducible/agh-runs` 留存合成运行事件、报告与健康快照。
跨目录修改原因：宿主实际选错固定凭据目录，需同步修正后端选择、回放/健康状态防误导、测试和实施证据。未修改 AGH 上游源码、模型凭据、Docker 数据盘或无关容器。
已完成：Docker Linux Engine 29.8.2 已响应；仅启动 `mqtt-audit-reproducible` 的两个回环 Broker，合成消息送达健康检查两端通过。真 Broker 完整 c1–c8 运行 `run-01146023-c9f4-4f57-a571-d0d159070e47` completed，205 条连续事件与 8 项报告、16 条双端判定一致，overall=fail，c3 源端 unknown/目标端 allow。受控停掉目标 EMQX 后，健康采样源端 connected/received、目标端 unreachable/unknown；恢复后两端 connected/received。关联 c3 局部复测 `run-d822bc49-cf86-488b-be57-369cccf49d36` 有 27 条连续事件，parentRunId 正确、coverage=partial、总体仍 fail。两次事件集的实时/完整回放状态与报告逐项一致。修复 AGH 插件优先选用当前 `.local/reproducible` 合成凭据，旧 `.local/env` 快照停止并过期；重复序号冲突不覆盖首次事件，监测停用立即标记快照过期。AGH `local-dev` 已在 4181 运行，当前插件 `trusted/enabled/running`、无 blocker，最终 integrity `sha256-5d324abaf00245865737db6de7ccdf86c122846624ca3c4cc47fcff1f2cdc497`、capability hash `9238d68726b419a5aa06df4aeb01eb0f5b6e0a86bf46d9279b7bfe8e49c8124e`。宿主自身在正确运行目录写出的健康快照两端 connected/received、未过期。Docker 两个固定 Broker 保持运行。
验证命令与结果：`node cli/environment.mjs check --name reproducible` → 两端 witness-received-message；直接受控工具 prepare/run 与只读状态/事件服务核对通过；`node --test tests/core/*.test.mjs tests/cli/*.test.mjs tests/plugin/*.test.mjs`（保留 Node 24.21.0）→ **82 pass / 0 fail**；`node --check plugins/agh/mqtt-audit-tools/extensions/dashboard/client/process.js` 与 `git diff --check` → 通过。`.local/update-panel.ps1` 官方 inspect/update 后 active integrity 与预览一致；Web HTTP 200。详见 [本批证据](evidence/dashboard-process-20261014.md)。
未完成/风险：没有本批官方 Agnes 真实会话中的 `prepare_run → run_check → read_result` 工具轨迹、同一 runId 的面板画面或由 Agnes 安排的复测证据。Jev 默认关闭，真实返回和比赛允许性未验收；演示视频与提交材料未完成。直接工具、安装状态、健康快照和离线回放不替代模型闭环。
阻塞原因：用户表示官方 Agnes 账户已启用，但本次官方 CLI 在当前隔离 `AGH_HOME` / `local-dev` 中返回 `PROVIDER_UNCONFIGURED`。未显式指定 data-dir 的 `agh daemon status` 与 Web 所连的是同一个运行中 daemon（PID 22568）；官方 `agh doctor provider --json`（未加 `--probe`）明确返回 `no configured provider route selected`。因此此实例尚无可用模型路由，不能发起真实 Agnes 会话。显式 WebSocket CLI 还要求独立的 `AGNES_WS_TOKEN`；没有读取该令牌或模型 Key。Jev 比赛规则尚待外部核实，未启用。
下一步：在本机 `http://127.0.0.1:4181/` 的设置中使官方 Agnes 模型账户对当前 `local-dev` profile 生效，然后用同一新会话发起固定目标，核对工具、事件、报告和右栏同一 runId，并形成脱敏证据；规则允许后才验收真实 Jev。

## 非 Docker 工作收尾（2026-10-14）

任务：完成当前过程面板和可选 Jev 接入中无需 Docker 的代码、测试与 `local-dev` 安装核对。
负责人：本次执行助手。
修改目录：`plugins/agh/mqtt-audit-tools/`、`tests/plugin/`、`docs/`；`.local/` 仅保存官方安装检查的本地临时记录。
跨目录修改原因：后端异常处理、针对性回归与验收记录需要同步；未改 AGH 上游源码、模型凭据或 Docker 数据。
已完成：健康采样遇到单侧探针异常时保留另一侧有效观测，异常侧显示未知而不推断 ACL 拒绝；Jev 响应按 32 KiB 上限读取，超限降级且不记录响应正文。新增两项针对性测试。AGH `local-dev` 已通过官方 inspect/update 装载本次代码，`trusted=true`、`desired=enabled`、`actual=running`、无 blocker；最终安装 integrity `sha256-61389ac8d96545362f5f4d6f969697066b6d24c99c7c5591b1460fff7f9f51bf`，capability hash `9238d68726b419a5aa06df4aeb01eb0f5b6e0a86bf46d9279b7bfe8e49c8124e`。
验证命令与结果：保留 Node 24.19.0 运行 `node --test tests/core/*.test.mjs tests/cli/*.test.mjs tests/plugin/*.test.mjs` → **81 pass / 0 fail**，含临时回环 MQTT 协议测试；`git diff --check` → 通过，仅工作区既有换行提示；AGH 管理 context 返回 `local-dev`，`.local/update-panel.ps1` 的 inspect/update 成功并确认 active integrity 一致。
未完成/风险：真实固定 Mosquitto/EMQX 健康复验、Broker 停机恢复依赖 Docker；真实 Agnes 会话的发起、工具轨迹、同一 runId 面板画面仍无证据；真实 Jev 返回及其与 Agnes 行动的对照仍未验收。安装态和离线测试不等于真实模型闭环。比赛是否允许 Jev 仍待外部规则核实，默认保持关闭。
阻塞原因：Docker Linux Engine 未恢复；AGH Web 当前停在模型账户设置引导，未读取或配置模型凭据；Jev 无实际服务调用且比赛规则未核实。
下一步：Docker 恢复后复验固定 Broker；模型账户由有权限者就绪后在当前 `local-dev` 真实 Agnes 会话核对工具、事件、报告、图形的 runId；规则明确后再决定是否进行真实 Jev 验收。

## MQTT 过程可视化与可选 Jev 实施（2026-10-14）

任务：实施 [面板计划](plans/dashboard.md) 的 P0–P4，并推进 P5 当前环境验收。
负责人：本次执行助手。
修改目录：`core/`、`plugins/agh/mqtt-audit-tools/`、`tests/plugin/`、`docs/`、`AGENTS.md`、`package.json`、`plugins/agh/README.md`；被忽略的 `.local/` 存运行记录、截图与合成浏览器验证。
跨目录修改原因：核心探针必须产出真实事件，AGH 工具/服务负责固定范围的运行管理与查询，React 组件消费同一事件；测试、操作说明和协作边界需与新接口保持一致。未改保留 AGH 上游源码、工具链、模型凭据或无关容器。

已完成：
- 核心增加可选事件出口、唯一运行消息关联标识和真实 MQTT 连接/订阅/发布/送达事件；确定性三态判定保持原语义。插件内嵌 core 与根目录逐字节同步。
- 新增提前准备 runId、首次全量/两轮以内局部复测、固定实例独占执行、追加事件、状态与增量查询；最终 JSON 报告仍为结论来源。进程死亡显示中断，序号缺口标明观察不完整。
- 独立 10 秒健康采样展示连接与消息往返。首次真 Broker 采样发现只读见证账号无法发布，已改为合成设备发布、见证账号接收；修正后真 Broker 复验待环境恢复。
- 右栏默认“过程”页含双端二维拓扑、节点证据、实时与历史回放、复测对比；暂停/跳转不会执行工具。发起和复测经 AGH 当前会话 prompt 入口，避免直接从浏览器访问 Broker。
- 可选 `mqtt_audit_plan_next` 固定 Jev 请求，默认关闭；只发送裁剪观测，最多三次建议、两轮复测，失败降级。Agnes 决定实际行动。AGENTS 边界加了仅此固定建议的例外。
- 0.3.0 插件经 AGH 官方 inspect/update 安装到现有 `local-dev`，`trusted/enabled/running`、无 blocker。该批安装 integrity `sha256-20a8e2aa22e6fdd68e9d147b3aebf3204587c879ded70a0f5945255146270fb1`，capability hash `9238d68726b419a5aa06df4aeb01eb0f5b6e0a86bf46d9279b7bfe8e49c8124e`；后续安装状态见上节。

验证命令与结果：2026-10-14 保留 Node24 `node --test tests/core/*.test.mjs tests/cli/*.test.mjs tests/plugin/*.test.mjs` 为 79 pass/0 fail；健康修正后 `node --test tests/plugin/process.test.mjs` 为 14 pass/0 fail。Edge 隔离合成浏览器 #test 返回 PASS，600px 截图复查文字对比度和上下拓扑。2026-10-13 固定真 Broker `run-78c0f511-1503-4335-bebd-55b6ab23bfa2` 205 条连续事件与 8 项报告逐项一致、总体 fail、c3 目标送达/源端 unknown；详见 [证据](evidence/dashboard-process-20261014.md)。安装 inspect/update 无 blocker。
未完成/风险：P3/P5 没有实际 Agnes 会话闭环；P4 没有实际 Jev 返回；健康修正尚未在真 Broker 重测。比赛 Jev 允许性待外部规则核实。旧文中的 0.2.0 能力与本批 0.3.0 状态按日期区分，不能当成同次验收。
阻塞原因：2026-10-14 Docker Desktop 未恢复 Linux Engine，固定两端回环端口不可达；用户建议的 `wsl --shutdown` 与 `Restart-Service WSLService` 均已执行，重启 Docker 后仍由旧 `docker-secrets-engine/engine.sock` 改名失败导致后端退出。已确认唯一 0 字节 socket、Docker 已退出及管理员目录权限；保留式目录改名仍被 Windows 拒绝。AGH Web 停在模型账户设置引导。没有读取或配置模型凭据，因此不能声称真实模型验证通过。
下一步：环境恢复后在同一固定 Broker 上复验健康、停机/恢复及局部复测；在真实 Agnes 会话核对 prepare/run/read 轨迹、事件、报告、右栏同一 runId；规则明确后才考虑启用 Jev，并脱敏归档实际证据。

## 递归 RS、决策与经验改进方案（2026-10-13）

任务：将用户提出的官方关注点与本项目现状整理为改进 Markdown 文档。
负责人：本次执行助手。
修改目录：`docs/`。
跨目录修改原因：无；仅新增方案并同步文档索引和交接。
已完成：新增 [改进计划](plans/improvement-plan.md)，分别记录递归 RS、快速决策、经验改进、执行过程与结果可视化的现状、证据、缺口、改进方向及验收标准；明确 RS 定义待官方原文核对，历史真实 AGH 接入与新版闭环证据分开记录。
验证命令与结果：`git diff --check -- docs/README.md docs/progress.md` 通过（仅有工作区存量 LF/CRLF 提示）；对新增 `docs/improvement-plan.md` 逐行检查，101 行均无行尾空白；检查改进文档与索引中的 24 个本地 Markdown 链接，缺失 0 个。本批仅修改文档，未运行代码测试或真实 AGH 会话。
未完成/风险：本文所列新增能力仍为待办；没有运行模型会话或将方案标为已实现。
阻塞原因：文档整理无阻塞；官方 RS 定义与评价口径尚待核对。
下一步：先验证当前 AGH 新版面板与同次真实报告，再按改进计划补齐反馈驱动验证、经验复用、可视化及效率证据。

## 最终交付范围确认（2026-10-13）

用户明确确认：当前工作区这份项目就是最终成品，不再向第二套 AGH 或其他工作区平移。此前进度、研发计划、部署说明中提出的第二套 AGH 安装/迁移步骤自本记录起不再是待办；历史批次记录保留原文，只表示当时的计划。当前仍待的是在现有隔离 `local-dev` profile 验收真实 Agnes 工具轨迹与同次 runId 面板显示，以及比赛演示视频和提交材料。此决定未改变插件运行逻辑或运行环境。

任务：同步最终成品范围，移除跨环境平移验收待办。
负责人：本次执行助手。
修改目录：`AGENTS.md`、根 README、`docs/` 与 `plugins/agh/README.md`；无运行时代码改动。
跨目录修改原因：协作规则、项目入口、研发计划、部署说明和插件说明都曾将第二套 AGH 验收列为当前要求，需保持一致。
已完成：将当前工作区与隔离 `local-dev` profile 明确为最终交付范围；将阶段 5 改为当前环境真实会话/面板验收与比赛材料；在证据索引说明该决定；保留早期批次的历史记录，并由本条说明其计划已被取代。
验证命令与结果：`rg -n "第二套 AGH|另一套 AGH|跨环境重新安装|平移" AGENTS.md README.md docs plugins/agh/README.md` → 当前状态文档均将其表述为已取消/不在范围；剩余命中位于旧批次记录或明确的范围说明。`git diff --check` → 通过，仅有工作区存量 LF/CRLF 提示。
未完成/风险：当前真实 Agnes 会话轨迹与面板画面、演示视频和提交材料仍未验收/完成。
阻塞原因：本次只更新范围和文档，没有启动模型会话或读取模型凭据。
下一步：继续在当前 AGH 环境完成真实会话验收和比赛材料；不进行第二套 AGH 平移。

## 官方 MHS 面板外壳适配（2026-10-13）

任务：按用户要求以官方面板为基础改造 MQTT 审计界面。
负责人：本次执行助手。
修改目录：`plugins/agh/mqtt-audit-tools/`、`tests/plugin/dashboard.test.mjs`、`plugins/agh/README.md`、`docs/dashboard.md`、本进度文档；被忽略的 `.local/` 合成界面预览和隔离 AGH 插件安装态。
跨目录修改原因：前端槽位、包版本/许可证、当前会话适配器与测试文档需一致；未修改保留 AGH 上游源码、工具链、系统配置或模型凭据。

已完成：
- 通过 GitHub 核实当前 MHS/Mars World 已公开，固定上游提交 `4bc36bc4c4441206388a53bece17379c1d7be14d`。官方 `hosts/agnes/index.tsx`、`layout/panel.tsx` 及样式作为外壳适配基础，保留原始 LICENSE、NOTICE、来源路径与修改声明。本机宿主仍为 `c4efd170…`，未执行 pull 或升级。
- 插件 0.2.0 注册 `rightbar`（priority -1）、`sidebar.panellist`、`shell.overlay`，支持拖动/键盘调宽、折叠、侧栏入口、全屏、Esc、焦点循环、停用清理和窄屏下方停靠。“概览/对照/轨迹”适配 MQTT 报告，不安装整套 MHS、不启动 AgnesHub、不添加网络监听或设备控制。
- 会话适配器仅提取当前会话 MQTT 工具及最新 runId；投影不可读显式报错；服务异常保留调用轨迹；过时请求不覆盖新会话。报告内 Broker 健康不冒充实时在线状态，未知不改成拒绝，无模拟流量动画。
- 原 4181 无服务；启动既有隔离 `local-dev` 后，用 `.local/update-panel.ps1` 通过官方 inspect/update 安装。包 `trusted=true / desired=enabled / actual=running`、无 blockers；integrity `sha256-d195a3e51d081bb745005f6cae604ecd46d37b5e4b6191278dd27e4631fc6e5e`，capability hash `1324518b617fe5dd1d2f2d6c6b38ad534cec27325fbe220ae5f01b4d5cb10c89`；client roster 包含新三个槽位。未提交、推送或发布。

验证命令与结果：
- 保留 Node 24 执行 `--check plugins/agh/mqtt-audit-tools/extensions/dashboard/client/index.js`、`--check .../official-shell.js` → 通过。
- 保留 Node 24 执行 `--test tests/plugin/dashboard.test.mjs tests/plugin/tools.test.mjs tests/plugin/sync.test.mjs tests/plugin/skill.test.mjs`（TEMP/TMP 指向 `.local/test-temp`）→ **22 pass / 0 fail**。涵盖旧报告隔离、运行中/失败不回退、轨迹数据裁剪、投影不可用和服务异常。
- `node .local/panel-preview.mjs` → 用实际插件 React 组件构建合成页面；独立临时 Edge `--headless --dump-dom ...official-panel-preview.html#test` → PASS：报告、unknown 证据、筛选、轨迹、键盘调宽、全屏/Esc、折叠/侧栏、会话切换竞态、停用后布局和订阅清理。沙箱内 Edge GPU 进程失败；经自动审批允许在沙箱外用独立配置重跑，无调试端口、不读取用户浏览器配置。
- 桌面 1600×1000 与窄窗 600×900 合成截图人工检查通过，聊天输入区和面板无重叠。430px 请求遇到 Edge 最小 viewport 截图裁切，未把该图当作 430px 验收；更小真实移动端尚未验证。
- `& .local/update-panel.ps1` → inspect/update 成功且 active integrity 匹配；HTTP 管理 context 为 local-dev，Web 返回页面。独立 AGH 浏览器停在模型账户设置引导，未确认真实会话内面板 DOM；不将运行态与合成预览替代真实会话证据。
- `git diff --check` → 通过，仅存量 LF/CRLF 提示。

未完成/风险：真实 Agnes 会话的工具结果/同次 runId/面板显示仍待验收；比赛材料仍待完成。新 rightbar 为单实例槽，与其他占用整个右栏的插件存在竞争；官方上游来源固定，后续同步需人工审查。
阻塞原因：独立浏览器进入模型账户设置引导，当前没有可验收的实际模型会话；未读取或改写模型凭据。
下一步（该批次原计划，已由 2026-10-13 最终范围决定取代）：在已有授权模型配置的 AGH 会话中运行本地目标句，核对新面板报告与工具 runId；原计划的第二套环境安装复验取消。

## UPX 本地安装（2026-10-11）

**任务：** 按用户请求安装官方 UPX 工具。**负责人：** 本次执行助手。**修改目录：** `.local/tools/upx-5.2.1/`（Git 忽略）与本进度文档；无跨目录修改。

**已完成：** 根据官方 GitHub 发布页下载 UPX 5.2.1 Windows x64 包 `upx-5.2.1-win64.zip` 并解压至 `.local/tools/upx-5.2.1/upx-5.2.1-win64/`。压缩包本地 SHA-256：`EABC6792A347D45E945BE7748423E7868FD01B0D2BCAA2F4B1031FD71FF69BDA`；可执行文件本地 SHA-256：`D20EBE0B7B22B6BE968C8C34BE61F94DDEA12CB11462E2CEC27F548EF9574DF8`。用户授权后，将该目录加入当前 Windows 用户 PATH；未改系统级 PATH。

**验证命令与结果：** `Invoke-WebRequest` 官方 release asset 下载成功；`Expand-Archive` 成功。机器架构为 Windows x64。Codex 沙箱内执行 `upx.exe --version` 报“无效的系统 DLL 重定位”；经授权在沙箱外执行，同一 x64 二进制返回 `upx 5.2.1`、退出码 0。加入用户 PATH 后，当前授权执行进程中的 `Get-Command upx` 指向 `.local/tools/upx-5.2.1/upx-5.2.1-win64/upx.exe`，`upx --version` 成功。相同 Windows build 和错误类型的 Codex 沙箱问题记录：[openai/codex #51674](https://github.com/openai/codex/issues/51674)；这是相关复现记录，不代表上游根因已确认。临时 Win32 对照包已清理。

**未完成/风险：** 新开的普通 Windows 终端会读取用户 PATH 并可直接运行 `upx`；当前 Codex 沙箱自身的映像重定位限制仍可能拦截该程序。没有更改或关闭此安全缓解设置。**下一步：** 在新的普通终端执行 `upx --version`；如需在 Codex 内运行，需由 Codex 修复该沙箱问题。

**状态：阶段 0–4 已完成；新语义真实 Broker 证据见阶段 4。可复现部署与 Docker Desktop 29.8.0 已实机启动；健康检查通过，默认 naive 固定案例审计已完成，并按预期发现 c3 目标端违反业务要求。部署模板修复了 `internal: true` 导致回环端口无法发布的问题，并将 Mosquitto 合成密码文件设为容器运行用户私有。2026-10-09 面板已更新到隔离 `local-dev` profile，client roster 登记 `rightbar.session`；Web 返回 200，但真实 Agnes 会话轨迹与报告显示仍待验收。第二套 AGH、目标句真实会话、演示视频与比赛提交包未完成。**

## 部署脚本与面板会话查询（2026-10-09 初始批次；后续状态见文末补充）

本节保留该批完成时的状态与阻塞记录；Docker 恢复和实际部署结果以后续“Docker 恢复后的部署与网络模板修正”批次为准。

**任务：** 继续完善可复现交付并修复面板跨会话结果来源；处理 Docker Desktop 启动故障。

**负责人：** 本次执行助手。

**修改目录：** 新增 `deploy/` 无凭据 Broker 模板，`cli/environment.mjs` 与 `tests/cli/environment.test.mjs`；更新根 `package.json`、README、CLI 与部署/架构/面板文档；修改 AGH 插件结果服务、工具输出与面板投影逻辑，以及 `tests/plugin/`。跨目录原因：环境脚本需与固定 Broker 镜像、端口、ACL 夹具和命令入口一致；面板查询逻辑、插件包、部署文档与测试必须描述同一数据流。未修改 vendor AGH、模型凭据或现有 `.local/env`。

**已完成：**

- `cli/environment.mjs init|up|check|audit|down` 可生成独立的 `.local/<名称>` 合成环境，固定镜像摘要与回环端口，源/目标 Broker 使用分离 bridge 网络并关闭 outbound IP masquerading；初始化拒绝覆盖，目录名受限并检查 junction/symlink。`down` 保留卷和数据。
- `check` 以见证者实际收到随机 MQTT 标记作为 readiness；`audit` 写本地报告。默认 naive 档案适用于展示 c3 业务要求失败；corrected、omission 档案可按新名字创建。
- 增加 [部署指南](deployment.md)，包括新机器启动、现有 `.local/env` 不接管原则、AGH 插件及 Skill 本地安装、第二套 AGH 验收步骤。
- 面板不再以目录中的“最近全局报告”推断当前结果。它读取 AGH 当前会话只读 UI 投影，只提取最近一项 `mqtt_audit_run_check` 的 runId，再以只读服务取报告；服务只接受受限 runId 并校验内容和大小。此方式遵守宿主对 `sessionId` 参数的过滤，不扩展身份接口。
- 为已安装插件执行了 inspect/update，包处于 trusted/running；**随后发现真实调用传入 `sessionId` 会被 AGH 过滤**，那版会返回 service unavailable。工作区源码已改为只读会话投影方案并通过离线检查，但当前 AGH 已停止，所以尚未安装这个最终源码快照。此前包摘要不可作为本次最终源码已部署证明。

**验证命令与结果：** `npm test`（使用保留 Node 24，临时目录位于 `.local/test-temp`）→ **62 pass / 0 fail**；`node --check plugins/agh/mqtt-audit-tools/extensions/dashboard/client/index.js` 通过；`git diff --check` 通过（仅存量 LF→CRLF 提示）。生成的 `.local/reproducible/compose.json` 通过 `docker compose config --quiet` 静态解析；`environment.mjs check --name reproducible` 将两端结果保守报为无法判定，因为 Docker 未运行。未读取模型凭据、未启动 Agnes 模型会话、未提交。

**Docker 故障与处理：** 用户截图报 `initializing Secrets Engine ... rename ... engine.sock ... engine.sock.stale: The file cannot be accessed by the system`。Docker Desktop 版本只读记录为 4.92.0.240144；目录仅含 0 字节 `Archive, ReparsePoint` 的 `engine.sock`。工作区脚本 `.local/repair-docker-secrets.ps1` 只在严格核验内容后保留并改名该通信目录、启动 Docker、检查 daemon，不删除任何镜像/容器/卷/凭据。普通执行和 `require_escalated` 目录改名均因 Windows `Access denied` 失败；通过 UAC 启动脚本后目录仍未改名，Docker daemon 不可用。参照的公开同类故障记录为 [docker/for-win #15064](https://github.com/docker/for-win/issues/15064)，报告的解决方法也是保留并重命名父目录；它不是 Docker 官方确认的根因分析。本批未点击恢复出厂设置、未删除 socket 或 Docker 数据。

**未完成/阻塞（当时状态，后续已更新）：** Docker Secrets Engine 当时无法启动。用户之后告知 Docker 已修复，部署实测见文末最新批次。AGH 已在隔离 `local-dev` profile 启动并完成最终插件 inspect/update/enable，client roster 当前登记 `rightbar.session`；浏览器真实绘制与会话内工具轨迹仍待验收。没有启动模型会话。

**下一步（当时计划，Docker 部署闭环现已完成）：** 刷新 `http://127.0.0.1:4181/` 检查右侧面板，在新会话使用一句目标执行真实 Agnes 工具闭环并检查面板报告；随后再测第二套 AGH、视频和提交材料。

## 简洁面板设计批次（2026-10-08）

任务：按用户要求使用 `frontend-design` Skill 收敛右侧面板的信息层级。负责人：本次执行助手。修改目录：`plugins/agh/mqtt-audit-tools/extensions/dashboard/client/`、`plugins/agh/README.md`、`docs/dashboard.md` 与本进度文档。跨目录原因：插件组件与样式一起更新，说明文档同步展示内容和实际部署状态。

撤去重复的四张统计卡和两张分布图，改为突出总体结论的状态区、四条验收维度、两端连接状态及案例清单。筛选改为下拉框；点开案例时在原位显示两端原因，原始证据另行展开。颜色跟随 AGH 明暗主题，状态色只用于结论；右栏改为内部细滚动条。保留三态、过期提示与只读数据边界。未改 core、Broker、AGH 上游或凭据。

验证：Node 语法检查与 `npm test` 均通过（54/54）；合成数据静态预览分别检查了主界面避让、文字层级、窄栏案例与内部滚动；AGH 官方 inspect 无 blocker，update 完成，当前包 integrity `sha256-fd8c6fc6622f350662142d59292907e3fc03bb1247235ef53b9268b154528e62`、trusted/running；client-module 当前修订与该摘要一致，`rightbar.session` 已登记；`mqtt-migration-audit` 仍是 trusted/enabled/ready 的同名胜出项。`git diff --check` 通过。没有启动模型会话、提交或发布。

未完成/风险：静态预览不等于当前 AGH 会话的真实 DOM；需在用户浏览器刷新后检查展开、收起、筛选和案例证据。下一步：完成当前浏览器验收，再做第二套 AGH 复验与视频材料。

## UI 避让与目标驱动 Skill 修复（2026-10-08）

任务：修复右栏遮挡与 `app.guide.empty` 空白页，加入让用户只说验收目标的 AGH Skill。负责人：本次执行助手。

修改目录：`plugins/agh/mqtt-audit-tools/extensions/dashboard/client/`、`plugins/agh/mqtt-audit-tools/skills/`、插件包清单、`tests/plugin/`、根测试脚本及 README/docs。跨目录原因：UI 槽位优先级和样式需与 AGH 安装包同步；Skill 是同包分发的资源；测试与交接文档记录实际状态。未改 vendor、模型配置或凭据，未提交。

| 命令或检查过程 | 结果 |
| --- | --- |
| 阅读 AGH 槽位内核与右栏实现 | 单一槽位按优先级升序选取：内置 `rightbar.session` 为 1，旧 MQTT 注册为 10，故只显示内置 `app.guide.empty` |
| 调整插件 UI 源码 | 注册优先级改为 0；桌面展开为对话及输入框预留右栏宽度，收起保留窄边签宽度；小屏展开改为置于对话区下方 |
| AGH 官方 inspect/update | 最终包 integrity `sha256-4de0b18535741c33e7ffbcffba2bc37da7939e809851d1b18b2f7d11f901d78f`，capability hash `f7b886df6efa7dcf2b105bbaf4083974d25005213042eff67e89705795af2926`；无 blocker；包 trusted、enabled、running |
| AGH `skills/list` | 包内 `mqtt-migration-audit` 为同名胜出项，`trusted / enabled / ready`；固定案例发现、运行、结果复读及 unknown 语义写入 Skill |
| `npm test`、Node 语法检查、`git diff --check` | 54/54 通过；语法与空白检查通过（仅存量 LF→CRLF 提示） |

未完成/风险：独立无头浏览器没有当前会话，无法据此确认会话中的最终渲染；当前用户浏览器刷新后需视觉验收。AGH 对明确提名的 Skill 有预加载路径，但仅说目标是否自动选中需新会话验证。未启动模型会话，未读取凭据。自动审批拒绝了带远程调试端口的浏览器验证，因为可能暴露 AGH 会话；未绕过。

下一步：在当前浏览器刷新 AGH，确认 MQTT 右栏取代 `app.guide.empty`，并验证展开/收起均不遮挡对话与输入框；新会话用目标句测试 Agnes 自主规划。然后在第二套 AGH 安装复验并制作演示材料。

## 本次范围与完成项

依据用户批准的初始化计划重置工作目录，暂名 `mqtt-permission-auditor`，只建立目录与文档，不实现业务功能。

- 删除旧 `agentshield/`、`frontend/`、`project/`、`tests/`、`docs/` 和 `pyproject.toml`；新建的 tests 与 docs 只含新项目说明。
- 建立 `core/`、`cli/`、`plugins/agh/`、`fixtures/`、`tests/`、`docs/` 骨架和职责说明。
- 重写 README、AGENTS、架构、进度、忽略规则和 vendor 包装说明，记录本地环境、查重来源、比赛要求与证据边界。
- 保留 Git 历史、AGH 源码及产物、工具链、本地配置和缓存。凭据未读取、未移动或复制；旧项目没有另存工作副本。
- 未启动模型会话，未新增可执行接口或功能测试，未创建远程仓库、发布或自动提交。

## 清理前检查

以下为实际执行的检查，均在本地工作目录完成：

| 命令或检查过程 | 结果 |
| --- | --- |
| `Get-Content` 读取旧进度、架构、环境与相关 README | 在删除前提取环境事实；旧会话成果不继承 |
| `git status --short`、`git log -1 --oneline` | 清理前无已跟踪文件改动；基线 `f5d40c2 feat: complete M3 recovery evidence matrix` |
| `Resolve-Path -LiteralPath` 核验六个删除目标；逐层 `Get-Item` / `Get-ChildItem -Force` 检查属性，不跟随重解析点 | 全部绝对路径位于 `<项目工作区>\` 内，共检查 368 个条目，重解析点 0；未包含保留目录 |
| 删除前再次检查目标和重解析点，再以 `Remove-Item -LiteralPath ... -Recurse -Force` 删除六个目标 | 六项删除完成，未触及目录外文件 |
| `git -C vendor/agnes-harness rev-parse HEAD` | `c4efd170547a225890664c1c186a7347399b53e0` |
| 读取上游 `package.json` 的版本约束；`& ./.tools/node24/node.exe --version` | Node 要求 `>=24.10`，pnpm 声明 `10.34.5`；实际 Node `v24.21.0` |
| `Test-Path -LiteralPath` 检查保留环境，`Get-FileHash -Algorithm SHA256` 记录 Node 与 AGH CLI 产物 | 文件存在，修改前摘要与初始化后完全相同，见下表 |

Git 曾提示无法读取全局 ignore 文件。本次不修改全局配置，后续以仓库检查的实际退出码和输出为准。

## 初始化后检查

以下均为实际执行的初始化检查，不是功能或 AGH 接入测试报告。

| 命令或检查过程 | 结果 |
| --- | --- |
| `git diff --check` | 通过；无空白错误，仅提示本机后续 Git 操作可能将 LF 转为 CRLF |
| `git diff --stat`、`git status --short` | 修改与删除符合本次重置范围；新目录和文档未暂存、未提交 |
| `rg --files core cli plugins fixtures tests docs`，并以 `Test-Path -LiteralPath` 核验必需说明和旧路径 | 新骨架齐全，仅含文档；旧代码目录及 pyproject.toml 不存在 |
| PowerShell 对 15 个 Markdown 文件用正则提取链接，以 `Join-Path` 和 `Test-Path -LiteralPath` 检查本地目标 | 29 个本地链接全部有效；外部来源链接不属于本次文件存在性检查 |
| `rg -n -i 'CyberClaim\|AgentShield\|claim-auditor\|cyber-claim\|inspect_claim_case\|run_audit_experiment\|summarize_audit\|frontend/server\|python -m\|M[0-4]' README.md AGENTS.md .gitignore core cli plugins fixtures tests docs vendor/README.md` | 逐项审阅命中：仅为进度中的删除/历史记录、环境路径及旧插件提醒；无旧项目可运行入口或旧成果声明 |
| `git check-ignore --quiet -- <path>` 逐项检查 14 个运行时、凭据、依赖、缓存及原始会话代表路径 | 14 项均被忽略；包括 AGH、工具链、AppData、.env、credentials.json、raw 证据和会话文件 |
| `git check-ignore --quiet --no-index -- <path>` 检查 10 个新骨架公开文件 | 10 项均未被忽略；全局 ignore 读取警告仍存在，未修改全局配置 |
| `Test-Path -LiteralPath` 检查 Git、AGH、Node、Corepack、AppData、pnpm 与原有缓存 | 10 个保留路径均存在 |
| `Get-FileHash -Algorithm SHA256 -LiteralPath '.tools/node24/node.exe','vendor/agnes-harness/packages/cli/dist/local/agnes.mjs'` | 两个文件的初始化前后摘要完全一致，见下方 |
| `git rev-parse --short HEAD`、`git -C vendor/agnes-harness rev-parse HEAD` | 根仓库仍为 `f5d40c2`，AGH 仍为 `c4efd170547a225890664c1c186a7347399b53e0` |

保留文件 SHA256：

```text
.tools/node24/node.exe
BA4E6D110E8C1592A1ECD390F6B05F3DA124B13871A5BE62B341A07A853C6C32
vendor/agnes-harness/packages/cli/dist/local/agnes.mjs
5AB8EC765BA847FE848FB8B798A7EA53F79792ABF4E26265239432CEA662E020
```

没有为初始化运行模型会话或功能测试。保留环境完整性的直接检查范围为上述路径、两个文件摘要及源码提交；未扫描凭据或全部运行数据。

## 计划文档批次（2026-10-07）

按用户批准的执行提示词新增两份计划文档（仅文档，未实现功能）：

- 新增 [环境准备方案](plans/environment-setup-plan.md) 与 [研发计划](plans/development-plan.md)；`docs/README.md` 导航未改动，待负责人审核后统一挂接。
- 检查：`git diff --check`（含对新文件的 `--no-index` 检查）无空白错误；两份文档共 20 个本地链接全部有效；术语与 [架构](architecture.md)、AGENTS 一致。
- 该批次核实的关键事实：本机已装 Docker Desktop（此前复核结论有误）；EMQX 自 5.9.0 起 BSL 1.1；Mosquitto 2.1.0 起弃用 `acl_file`/`password_file`（由 builtin-security 插件承载）。

## 环境批次执行记录（2026-10-07）

经用户明确指示（"打不开我的docker吗"→"继续"）启动环境批次。全部命令在本机完成，只触达本地容器与公共镜像仓库：

| 命令或检查过程 | 结果 |
| --- | --- |
| 启动 Docker Desktop 并轮询守护进程 | 约 20 秒就绪，客户端/服务端 `29.8.0`，`docker-desktop` WSL2 发行版 Running |
| `Get-NetTCPConnection -LocalPort 1883,2883,18083`、`(Get-PSDrive C).Free` | 端口全空闲；C 盘剩余约 71.4 GB |
| `docker pull eclipse-mosquitto:2.1.2-alpine`、`docker pull emqx/emqx:6.3.1` | 均成功；摘要见 [环境版本记录](environment-versions.md) |
| `docker image inspect`（两镜像） | Mosquitto 标签许可 `EPL-2.0 OR BSD-3-Clause`；EMQX 标签 `BSL-1.1`、Edition `Enterprise`、Debian 13 |
| 新建 `.local/env/compose.yaml` 与 Mosquitto 配置；`git check-ignore -v` | 运行文件全部被 `.gitignore` `.local/` 规则覆盖 |
| `docker compose -p mqttaudit up -d`（摘要固定镜像） | 两容器创建；Mosquitto 首次因 passwd 缺失退出（码 13），生成凭据并修权限后正常运行 |
| 源端健康检查：认证发布-订阅往返 + 错误口令 | 往返成功（消息实际送达）；错误口令被拒 `not authorised`（客户端退出码 5） |
| 目标端健康检查：`emqx ctl status` + 匿名发布-订阅往返 | 节点 `6.3.1` started；往返成功（开箱默认允许匿名，阶段 1 需收紧） |
| `docker compose -p mqttaudit down -v` 及残留检查 | 容器/网络/卷全部移除，1883/2883 端口释放；用户原有容器未触碰 |

关键实测行为（阶段 1 输入）已固化到 [环境版本记录](environment-versions.md)：Mosquitto 2.1.2 经 builtin-security 插件加载 `password_file` 且未见弃用警告；passwd 属主警告"未来版本将拒绝加载"；EMQX 默认匿名放行。

## 阶段 1 执行记录（2026-10-07，ACL 差异复现）

经用户指示继续，按 [研发计划](plans/development-plan.md) 阶段 1 执行；两次完整建拆循环加一次取证复验，全部在本机隔离环境完成：

| 命令或检查过程 | 结果 |
| --- | --- |
| 配置两端认证：Mosquitto `password_file`（6 用户）；EMQX `built_in_database` + bootstrap CSV | 认证生效：错误口令两端均被拒；bootstrap CSV 空卷自动重建用户，可复现 |
| Mosquitto 2.1.2 加载 `acl_file` | 可用；经 builtin-security 插件（`acl-check` 事件），无弃用警告；文件权限/属主仅告警 |
| EMQX 6.3.1 默认授权链（`emqx ctl conf show authorization`） | `no_match=deny`、`deny_action=ignore`、file 源；hardened 下旧兜底 allow 不生效；匿名被拒 |
| 行为矩阵探针（见证法：auditor 同主题订阅判定实际送达） | 9 项矩阵两端全部取得"送达/未送达 + 协议信号 + 日志"证据，见 [阶段 1 证据](evidence/stage1-acl-difference-20261007.md) |
| P3 核心对照（device-sensor 发布 factory/admin/secret） | 源端拒绝（未送达 + `Denied PUBLISH` 日志）；目标端朴素迁移顺序下**送达**——权限扩大证实，业务要求"仅 ops-admin"目标端失败 |
| 顺序对照 | Mosquitto deny 前置仍拒绝（顺序无关）；EMQX 拒绝前置后拒绝（顺序即修复），双 AUTHZ 告警日志佐证 |
| 语法排查 | `topic deny write <t>` 为无效写法："write " 并入主题名、deny 静默失效；正确为 `topic deny <t>`（deny 占限定词位置） |
| `docker compose -p mqttaudit down -v` 及残留检查 | 三次循环均无残留容器/网络/卷，端口释放 |

关键陷阱（阶段 2 必须处理）：两端发布被拒时客户端 `pub_exit=0` 静默丢弃——允许判定只能依据送达见证；EMQX 订阅拒绝退出码 0 仅文本提示、Mosquitto 订阅拒绝表现为超时。

## 阶段 2 执行记录（2026-10-07，核心与 CLI）

| 命令或检查过程 | 结果 |
| --- | --- |
| 新增 package.json（ESM、零运行时依赖、Node ≥24.10）与 core/cli/fixtures/tests 实现文件 | core：MQTT 客户端、送达见证探针、三态运行器、报告渲染；cli：`run-audit.mjs`；fixtures：migration-baseline 8 检查 |
| `node --test tests/core/*.test.mjs` | 18 pass / 0 fail（编解码、聚合语义、运行器门控） |
| 集成 R1 naive 档案真实运行 | 总体失败，c3 权限扩大（源拒/目标送达），退出码 1 |
| 集成 R2 omission 档案真实运行 | c3 扩大 + c4/c5 业务受损，退出码 1 |
| 集成 R3 停止目标端 | 目标侧 8 项全部无法判定、不计扩大/受损，退出码 2；首跑暴露未处理拒绝崩溃，修复后复测通过 |
| 集成 R4 恢复复测 | 检查结论签名与 R2 程序化一致，未知归零，退出码 1 |
| `docker compose -p mqttaudit down -v` 残留检查 | 无残留容器/网络/卷，端口释放 |

记录详见 [阶段 2 证据](evidence/stage2-core-cli-20261007.md)；README（core/cli/fixtures/tests）已同步为已实现状态。

## 阶段 3 执行记录（2026-10-07，AGH 插件）

| 命令或检查过程 | 结果 |
| --- | --- |
| 构建 `plugins/agh/mqtt-audit-tools`（自包含：manifest+TypeBox 参数+core/fixtures 副本+唯一实例注册表） | `tests/plugin` 新增 8 项测试，全套 `npm test` 26 pass / 0 fail（含副本逐字节一致守护） |
| AGH daemon（保留 home，local-dev，127.0.0.1:4180）启动 | 后台进程曾被终止一次；重启后插件自动恢复加载（host.jsonl 三次 registered + loaded） |
| `package status` / `doctor extensions` / host.jsonl | CLI status 仅列三官方助手、doctor 报 assembly failed，与 Web 视图及 host.jsonl 矛盾，如实记录为未解事实；旧插件 `claim-auditor-m0` 已在 Web 停用 |
| `package inspect` + Web"从来源安装"（CLI 非 TTY 确认被强制拒绝，属安全设计） | integrity `sha256-ba9a7c6e…`、capability hash `e3de4e5f…`，安装/启用均 Completed |
| Web 真实会话（agnes-3.0-flash，52 秒）：`mqtt_audit_list_cases`（11ms）→ `mqtt_audit_run_check`（30s） | Trace 工具事件与结构化返回齐全；结果落盘 `.local/env/agh-runs/run-…d27bb3.json`，结论与阶段 2 naive 运行一致（c3 扩大，overall=fail） |
| disable → 再 enable 周期 | 开关撤下/恢复均成功，重新注册三工具 |
| `docker compose -p mqttaudit down -v` | 无残留 |

记录详见 [阶段 3 证据](evidence/stage3-agh-plugin-20261007.md)。

## 审查修复批次执行记录（2026-10-07，两项高优先级修复）

| 命令或检查过程 | 结果 |
| --- | --- |
| `core/runner.mjs` 新增 `validateBroker`（仅允许数字回环 `127.0.0.1`，端口 1–65535），`runAudit` 入口先于健康检查执行；`cli/run-audit.mjs` 的 `parseEndpoint` 同样强制并导出（加入口守卫供测试导入） | 拒绝 localhost、域名、非回环 IP、`0.0.0.0`、IPv6 与其他主机；守护测试证明非法地址下健康检查与探针零调用 |
| `core/prober.mjs` 重构判定：提取纯函数 `decidePublishVerdict` / `decideSubscribeVerdict` | "PUBACK 但未送达"改判**无法判定**（原误报拒绝）；拒绝仅凭明确协议证据（CONNACK 4/5、SUBACK 0x80）；订阅"授予但未送达/无 SUBACK"也改判无法判定；`evidence.limitation` 说明限制与 MQTT 5 reason code 候选路径 |
| 插件副本同步（`cp` core/prober/runner/report → `plugins/agh/mqtt-audit-tools/core/`，`diff -q` 逐字节核验） | 一致；`tests/plugin/sync.test.mjs` 通过 |
| `npm test`（新增 `broker-guard`、`verdicts`、`cli/parse-endpoint` 三个测试文件） | **43 pass / 0 fail**（原 26 → 43） |
| 固定案例语义守护测试 | c3 新语义：源端未送达=unknown 不汇总为扩大/受损/通过；目标端送达仍构成业务要求失败 |
| `docker version --format server=…`（只读查询） | 守护进程不可达（server 为空）：本批未启动 Docker，集成重跑阻塞，如实记录 |
| 文档同步 | 根 README、docs/README（含新导航）、architecture、evidence/README、competition、environment-setup-plan（健康检查草案修正：弃用对 2883 的 HTTP curl，改为容器内 `emqx ctl status` + MQTT 往返）、development-plan（阶段状态列）、本页 |
| `git diff --check`（含对本批全部新文件的 `--no-index` 检查）与涉及文档链接检查 | 均通过（仅存量 LF→CRLF 警告，与既往批次一致；无 MISS 链接） |

语义变更影响（如实说明）：发布级拒绝在 MQTT 3.1.1 无协议级证据，[阶段 2 证据](evidence/stage2-core-cli-20261007.md)中依赖"puback-without-delivery=拒绝"的分类结果（如 c2/c8、c3 源端拒绝、c4 发布类受损）属旧语义，需在阶段 4 以新语义对真实 Broker 重跑后再引用；目标端正向证据（禁止主题实际送达 → 业务要求失败）不受影响。

## 判定语义修正批次执行记录（2026-10-07，CONNACK 连接层拒绝）

| 命令或检查过程 | 结果 |
| --- | --- |
| `core/prober.mjs`：新增纯函数 `classifyIdentityConnectFailure`（发布/订阅共用），删除 CONNACK 4/5 → deny 分支 | CONNACK 4/5（连接层认证拒绝）与未知连接失败均判**无法判定**，`evidence.connackCode` 与错误信息保留在 reason/evidence；不证明主题级 ACL 拒绝 |
| `decidePublishVerdict` / `decideSubscribeVerdict` 移除 `connackRefused` 入参 | 主题级拒绝证据仅剩 **SUBACK 0x80**（订阅）；发布未送达维持 unknown；未引入 MQTT 5 判定 |
| 文案修正：`core/prober.mjs` 头注与 `NO_DENIAL_EVIDENCE_NOTE`、`core/report.mjs` 范围声明、`core/README.md`、`docs/architecture.md` | 均改为"CONNACK 属连接层拒绝、判无法判定"的表述，不再把 CONNACK 称为 ACL 拒绝证据 |
| 插件副本同步（prober/report → `plugins/agh/mqtt-audit-tools/core/`，`diff -q` 核验） | 逐字节一致；`tests/plugin/sync.test.mjs` 通过 |
| 证据文档历史标注（不改写原文） | [阶段 2](evidence/stage2-core-cli-20261007.md) 与 [阶段 3](evidence/stage3-agh-plugin-20261007.md) 头部加"语义修订标注"：旧"未送达=拒绝"分类为历史记录，待新语义重跑后再引用；接入类证据不受影响 |
| `npm test` | **46 pass / 0 fail**（上批 43 → 46：CONNACK 4/5 双动作 unknown、未知连接失败 unknown、SUBACK 0x80 仍 deny、"连接层拒绝不得冒充主题 ACL 拒绝/不得计入扩大受损或要求拒绝通过"守护、两端均连接拒绝时整体 unknown 对照） |
| `git diff --check`（含本批文件 `--no-index`）、涉及文档链接检查 | 通过（见下方交接） |

本批未启动 Docker（守护进程不可达，仅只读确认）、未启动 AGH/模型、未做真实 Broker 集成、未提交。

## 状态文档补同步批次（2026-10-07，审核反馈）

| 命令或检查过程 | 结果 |
| --- | --- |
| 根 README、docs/README、architecture 状态行补充限定 | 明确"阶段 0–3 历史证据基于当时判定语义；修正后语义未做 Broker 集成验证、AGH 已安装快照仍为旧版，待阶段 4 重跑/重装后引用"，与本页风险说明一致 |
| CONNACK 措辞修正（`core/prober.mjs` 注释与 NOTE、`core/report.mjs`、`core/README.md`、`docs/architecture.md`） | "连接层认证拒绝"统一改为"连接建立阶段拒绝"；历史批次记录原文保留不改写 |
| 插件副本同步（prober/report）+ `diff -q` + `npm test` | 副本逐字节一致；**46 pass / 0 fail** |

本批仅文档与注释措辞，未启动 Docker/AGH，未提交。

## 阶段 4 新语义集成复验（2026-10-08）

| 命令或检查过程 | 结果 |
| --- | --- |
| 只读检查 Docker/WSL 并启动已安装 Docker Desktop | 普通会话无法访问 Docker named pipe，WSL 查询返回 E_ACCESSDENIED；经受控提权启动现有 Docker Desktop 后，Docker Engine 29.8.0 可用。未安装软件或修改系统配置 |
| 检查 Compose 配置、摘要镜像与端口 | 配置有效，复用原 Mosquitto/EMQX 固定摘要；Windows TCP 排除范围包含 1857–2256，1883 实际绑定失败。将被忽略的本地 Compose 源端映射改为 127.0.0.1:11883:1883，EMQX 保持 127.0.0.1:2883:1883；两端仍只绑定回环、网络相互隔离 |
| 启动本地 Compose；查询容器状态与 emqx ctl status | 两个固定摘要 Broker 均运行；Mosquitto 11883 → 1883、EMQX 2883 → 1883；EMQX 6.3.1 is started |
| 新语义重跑 naive ACL 全案例，JSON 保存到忽略目录 stage4-report-naive.json | 总体失败；c3 目标端实际送达，违反独立业务要求；源端 c3 未送达为 unknown，因此不虚报权限扩大。c2/c8 发布未送达、c7 源端订阅无明确拒绝证据为 unknown。退出码 1 |
| 切换到 acl-omission.conf 并重跑全案例，保存 stage4-report-omission.json | 总体失败；c5 目标端收到 SUBACK 0x80，确证业务必需订阅被拒，计为业务受损；c3 目标端实际送达仍违反业务要求；发布未送达项仍 unknown。退出码 1 |
| 停止 EMQX、运行全案例、恢复 EMQX、再次运行；保存 stopped/recovered 报告 | 停机轮目标侧 8 项全部 broker-unavailable/unknown；总体 unknown、退出码 2，不计扩大或受损。恢复轮签名与停机前 omission 轮逐项及汇总一致，程序化比较通过 |
| 将 EMQX ACL 拒绝行前置后重跑全案例 | c3 目标端未送达转为 unknown（不是拒绝），权限扩大为 0；c4/c5/c6 两端允许且业务要求通过；整体 unknown 符合 MQTT 3.1.1 发布拒绝证据限制，退出码 2 |
| 从固定 c1 派生单项正常发布 smoke fixture 并运行 | 两端见证者均实际收到；总体通过、2/2 端侧要求通过，退出码 0；样例与报告仅保存在被忽略目录 .local/env |
| 本批输出与脱敏摘要 | 可引用摘要见阶段 4 证据；原始 JSON 仅在被忽略目录，未纳入仓库 |

事实与局限：新语义已通过真实 Broker 集成验证；MQTT 3.1.1 下发布 ACL 拒绝仍没有协议级证明，因此没有因 deny 顺序修复就声称 c3 通过。新增证据覆盖真实送达、SUBACK 0x80、目标端停机 unknown 与恢复签名；未引入 Broker 日志解析。阶段 4 代码/集成验证已完成，AGH 客户端面板真实安装渲染仍属待做。Docker Desktop 因隔离策略须通过受控提权访问 named pipe；运行容器仅使用合成数据与回环绑定。

## AGH 审计结果面板实现批次（2026-10-08）

| 命令或检查过程 | 结果 |
| --- | --- |
| 在插件包中新增 `workbench.panel` client module 与 `mqtt-audit.latest-result` 后端 query service | 面板展示双 Broker 健康、三态摘要、观测分布、逐项检查筛选和证据详情；查询无入参，只读取固定 `agh-runs/run-*.json` 并校验报告 schema，不接触凭据、不写数据、不访问外网 |
| AGH 包清单与 client descriptor | 新服务行独立绑定前端模块；客户端只声明 `workbench.panel` 与唯一只读 query service，未修改 vendor、保留 AGH 源码或系统配置 |
| `tests/plugin/dashboard.test.mjs` | 新增 6 项离线测试，覆盖 unknown 统计/筛选、最新报告选择、忽略非报告 JSON、服务无参数合同、清单绑定和后端服务注册 |
| `node --test tests/core/mqtt-codec.test.mjs tests/core/aggregation.test.mjs tests/core/runner.test.mjs tests/core/broker-guard.test.mjs tests/core/verdicts.test.mjs tests/cli/parse-endpoint.test.mjs tests/plugin/tools.test.mjs tests/plugin/sync.test.mjs tests/plugin/dashboard.test.mjs` | **53 pass / 0 fail**；本批未启动 Docker、AGH 或模型会话 |
| AGH `package inspect`（只读尝试） | 未能完成：本地 CLI 无法解析保留 AGH home 的 daemon scope；未尝试初始化或启动保留 AGH 环境 |

当时限制：面板尚未在 AGH Web 实际安装和渲染；服务能力需要隔离演示 profile 显式允许，保留环境 profile 未改动。面板离线实现和单测不能替代 AGH 接入证据。后续集成进展见下方记录。

本次 AGH 尝试的补充事实：保留的旧 home 路径不存在，4180 无监听。按上游 fullstack 指南新建了被忽略的独立实验 home，并只在该 profile 增加 services capability；doctor profile 检查通过，但 serve 与 daemon start 均在 ready 前退出（daemon child exit 1），因此未执行 package inspect/install、未在 Web 渲染。未读取模型 Key 或启动会话，保留 profile 未修改。

面板续开发：明确标注“本机最近一次保存的报告”，报告时间缺失或超过 15 分钟显示“结果已过期”，不改变结论。纯函数过期判断新增测试，最终全套测试为 53 pass / 0 fail。

## AGH 面板包检查与隔离安装（2026-10-08）

| 命令或检查过程 | 结果 |
| --- | --- |
| AGH CLI 检查内置 client-service-panel 示例包 | 检查通过，确认隔离 AGH daemon 与包管理器可工作；定位到 MQTT 包失败来自自身静态清单，不是 daemon 阻塞 |
| 修正 AGH 服务名：`mqtt-audit.latest-result` → `mqtt.audit.latestresult` | AGH 后端 `services` 清单字段只允许小写字母、数字和点号；client descriptor、服务注册、浏览器调用、离线测试与文档已统一。只读调用上游 `inspectStaged` 暴露 schema 校验原因 |
| `agnes package inspect file:./plugins/agh/mqtt-audit-tools` | 通过；预览 `mqtt-audit-tools@0.1.0`，integrity `sha256-ad51379500bd6809099a6b1231efa082510854b0e924df0b1fb0f91ca2e00d12`，仅 `client` contribution，来源未验证警告已保留 |
| `agnes package add ...`、`package trust ...`、`package enable mqtt-audit-tools` | 仅在被忽略的 `.local/env/agh-demo/home` 隔离 profile 中完成；安装先保持 disabled/untrusted，再用检查所得 integrity 与 capability hash 授信。最终 `desired enabled; actual running; trusted true`。日常 AGH home 未修改 |
| 查询 AGH 写入的 client module roster，并检查 `http://127.0.0.1:4181/` | roster 已登记 `workbench.panel`、前端资源、后端 row 和唯一 query service `mqtt.audit.latestresult`；Web HTTP 200，Edge headless 截图确认 AGH 首页可加载 |

面板在活动工作台会话中的实际渲染仍未确认：隔离 profile 没有模型 provider，也没有活动会话。没有读取或设置 Agnes Key、没有启动模型会话；不能将包已运行或 Web 首页可加载说成面板真实渲染或 AGH 模型闭环通过。`doctor` 的 extension host / code-runtime assembly fail 仍需目标演示环境复查。

## 当前交接补充（2026-10-08，AGH 面板集成）

**任务：** 继续完成结果面板开发并验证插件包在隔离 AGH 环境中的安装状态。

**负责人：** 本次执行助手。

**修改目录：** `plugins/agh/mqtt-audit-tools/`（服务名清单、服务实现、前端调用）、`tests/plugin/dashboard.test.mjs`（断言同步）、`docs/dashboard.md`、`plugins/agh/README.md`、根 `README.md`、`AGENTS.md`、本页。另使用被忽略目录 `.local/env/agh-demo/` 建立隔离 AGH profile 与只读截图；未改 `vendor/`、日常 AGH profile 或 Docker 配置。

**跨目录修改原因：** AGH 包静态检查拒绝原服务名语法；前后端声明必须一致并同步验证与文档。实验 profile 只用于检查并启用此本地插件，不含模型凭据。

**已完成：** 修正服务名；AGH package inspect、add、trust、enable 流程成功；插件状态为 running；client module roster 包含前端入口、`workbench.panel` slot、样式和唯一 query service；AGH Web 首页返回 200。

**验证命令与结果：** `agnes package inspect file:./plugins/agh/mqtt-audit-tools` 成功；`agnes package status` 显示 `mqtt-audit-tools@0.1.0 desired enabled; actual running; trusted true`；client module roster 绑定检查通过；Edge headless 页面截图成功。全套 Node 单测、`git diff --check` 与文档链接检查待本批收尾复跑。

**未完成/风险：** 因隔离 profile 尚无模型 provider/活动会话，`workbench.panel` 未在会话画布实际渲染；Agnes 真实会话和第二套 AGH 可移植性验证未做。AGH `doctor` 的 extension host 与 code-runtime assembly 检查仍 fail，需在比赛演示环境复查完整工具闭环和 UI。

**阻塞原因：** 本任务没有可用演示 provider/官方 Agnes Key；按要求未读取或配置凭据，也未启动模型会话。

**下一步：** 在目标比赛 AGH profile 按官方流程安装并核对 capability hash；配置官方 Agnes 模型后确认活动会话面板渲染与真实工具调用，再录制演示、完成第二套 AGH 重装验证和提交材料脱敏。

## 浏览器所用 AGH 实例安装补正（2026-10-08）

用户截图显示其 AGH“已安装”列表只有三个官方 helper。此前的隔离 profile 检查不能证明浏览器实例已安装；本批直接核对浏览器 AGH 的同源管理 API，并在该实例完成安装。

| 命令或检查过程 | 结果 |
| --- | --- |
| `GET http://127.0.0.1:4181/admin/plugins/api/context` 与同源 `POST .../list` | profile 为 `local-dev`；安装前确实只有三个官方 helper，与截图一致 |
| 同源 `POST .../inspect`，来源 `file:./plugins/agh/mqtt-audit-tools` | 检查完成：`mqtt-audit-tools@0.1.0`，integrity `sha256-ad51379500bd6809099a6b1231efa082510854b0e924df0b1fb0f91ca2e00d12`；无依赖、无 capability diff；保留 provenance 未验证提示 |
| 同源 `POST .../install`、`POST .../trust`、`POST .../enable` | 三个操作均 completed；最终 Web API 与 `agnes package status` 均显示 `desired=enabled`、`actual=running`、`trusted=true` |
| 检查 AGH `data/daemon/client-modules/local-dev/_client-modules.json` | 当前 integrity 已登记前端 entry/style、`workbench.panel`、`mqtt.audit.latestresult` service 和后端 row |

**交接：**

任务：将 MQTT 插件安装到用户截图所示的 AGH 实例，而非只保留在先前隔离安装记录中。

负责人：本次执行助手。

修改目录：仅 AGH 当前 `local-dev` profile 的包管理状态；项目文档 `docs/progress.md`。

跨目录修改原因：运行时安装由用户明确要求；进度文档记录实际部署状态。

已完成：通过 AGH 自身检查、安装、授信、启用流程完成本地安装；浏览器同源 API 返回的已安装清单现包含 `mqtt-audit-tools@0.1.0`，运行态为 running；面板 roster 已注册。MCP 与 Skill 无需单独安装，本包提供的是 AGH 插件及其工具和工作台面板。

验证命令与结果：AGH 管理 API `context`/`list`/`inspect`/`install`/`trust`/`enable` 与操作轮询均成功；安装前 list 只有三个 helper，安装后包含 MQTT 插件；`agnes package status` 显示 trusted/running；client module roster 含 `workbench.panel` 和 `mqtt.audit.latestresult`。未读取模型 Key，未启动 Agnes 模型会话。

未完成/风险：当前已存在的 Agnes 会话可能保留安装前的工具快照；尚未在新会话中实测模型调用，也尚未看到面板在会话画布中的最终渲染。

阻塞原因：无安装阻塞；下一步需要在浏览器刷新后新建会话，以加载新的工具快照并人工验收画面。

下一步：刷新 `http://127.0.0.1:4181/`，确认“已安装”出现 MQTT 插件；新建会话后测试 `mqtt_audit_list_cases`、`mqtt_audit_run_check`，并查看右侧 MQTT 权限迁移验收面板。

## AGH 主界面避让与右侧折叠面板（2026-10-08）

用户验收发现面板占用主内容区，挤压 AGH 原界面。本批将浏览器扩展移入 AGH 右侧 `rightbar.session` 槽，并增加可持久化的收起/展开窄边签。

| 命令或检查过程 | 结果 |
| --- | --- |
| 查看 AGH `WEB_CLIENT_MODULE_SLOT_NAMES`、`mountRightbarRegion` 与工作台样式 | 确认 `rightbar.session` 是宿主独立浮动侧栏内容槽；`workbench.panel` 挂在主内容区，确为挤压来源 |
| 更新 client descriptor 与组件 | 槽位改为 `rightbar.session`；窄栏改用单列健康状态、摘要、案例对照和证据；添加可访问的收起/展开按钮，偏好保存在浏览器本地存储；没有改 AGH 上游代码 |
| 首轮 AGH 更新与名册核验 | 包已运行，但名册保留旧 `workbench.panel`。依据上游 client-module 校验逻辑，发现 DSH 槽必须声明 `slotCatalogVersion`；未把首轮包状态当作面板已切换 |
| 增加 `slotCatalogVersion: dsh-client-slots/v1` 后再次执行 AGH inspect/update/activate | inspect 无 blocker；第二次更新成功，当前 integrity `sha256-5919e752813618a63aa2b56849629fc752d42f65ca33367a519572ce0af577ef`，capability hash `d5b9772c4bc3aef38aa9a1fcbbc58fdc967e83e5bfb31f0be751befeda2c3941` |
| 读取 active profile 的安装清单、运行树及 client-module 状态 | 包为 enabled/running/trusted；运行树 `actual=true`、`pending=false`、`reportOk=true`；当前 client-module revision 已切为新 integrity，当前声明为 `rightbar.session`，旧 revision 仅保留作历史快照 |
| `npm test`、`node --check plugins/agh/mqtt-audit-tools/extensions/dashboard/client/index.js`、`git diff --check` | **53/53 通过**；语法检查通过；diff 检查通过，仅有工作区既有 LF→CRLF 提示 |

真实浏览器画面未由执行助手截图核验。用户刷新 `127.0.0.1:4181` 后即可看到右侧面板；标题区按钮可折叠，收起后保留右侧窄边签。现有 Agnes 会话的工具快照可能仍是旧状态，新建会话后再验收工具调用。MCP/Skill 不单独安装，本包只作为 AGH 插件提供工具和结果面板。

## 历史交接（2026-10-07）

任务：初始化项目、交付计划文档、执行环境批次与阶段 1–3；2026-10-07 两个审查批次完成三项修复（Broker 地址锁定、发布未送达 unknown、CONNACK 连接层拒绝 unknown）与状态文档同步。

负责人：本次执行助手。

修改目录：core（runner/prober/report）、cli（run-audit）、plugins/agh/mqtt-audit-tools/core（副本同步）、tests（verdicts 重写、新增 3 文件）、package.json；docs 与 README 状态同步及证据历史标注。vendor 未改动；未提交。

跨目录修改原因：审查指令要求 core/CLI 与插件副本同步修复，并同步全部状态文档。

已完成：三项修复均落地——地址仅 127.0.0.1（双层校验）、"PUBACK 未送达"=unknown、CONNACK 4/5=unknown（连接层，不冒充主题 ACL 拒绝，SUBACK 0x80 为唯一主题级拒绝证据）；46/46 单测通过；stage2/stage3 证据加历史语义标注（原文保留）。

验证命令与结果：`npm test` → 46 pass / 0 fail；`git diff --check` → 通过；涉及文档链接检查 → 无 MISS。全程未启动 Docker/AGH、未连接外部目标。

未完成/风险：新判定语义未经真实 Broker 集成验证（Docker 守护进程不可达，本批不启动）；阶段 2/3 证据中依赖旧语义的分类待阶段 4 重跑；发布级拒绝证据路径（MQTT 5 reason code）待评估；AGH 已安装插件快照仍为修复前版本，需重装后才会以新语义运行。

阻塞原因：集成验证阻塞于 Docker 守护进程未运行（按指令本批不得擅自启动）。

下一步：技术负责人审核本批改动；批准后进入阶段 4——启动本地 Broker 以新语义重跑固定案例集（验证 CONNACK/未送达均落 unknown、SUBACK 0x80 仍 deny），评估 MQTT 5 拒绝证据路径，归档三类样例证据，并重装 AGH 插件快照。

## 历史交接（2026-10-08 阶段 4）

**任务：** 完成阶段 4 新语义真实 Broker 集成复验、三类样例证据归档，并同步本机回环端口映射。

**负责人：** 本次执行助手。

**修改目录：** plugins/agh/mqtt-audit-tools/instances.json、CLI 端口示例、tests/plugin/sync.test.mjs；docs README、环境准备/版本、研发计划、证据 README 与新增阶段 4 证据。被忽略的 .local/env Compose 端口映射与 Broker ACL 档案用于本地复验。vendor 未改动；未提交。

**跨目录修改原因：** Windows 将 1883 列入 TCP 排除范围，需把本地源端映射统一到 11883，并同步 CLI、插件固定实例与部署文档；阶段 4 实测摘要需挂接进度、计划与证据导航。

**已完成：** 新语义下 naive、omission、修复 ACL、Broker 停机/恢复和 c1 正常 smoke 均在固定摘要本地 Broker 上复验；SUBACK 0x80 拒绝与三态边界符合设计；停机恢复签名比对一致；阶段 4 正常/边界/失败样例已归档。插件固定源端更新为 127.0.0.1:11883。

**验证命令与结果：** 六份本地 CLI 报告分别覆盖正常、naive 失败、omission 失败、停机边界、恢复、修复 ACL；recovered 与 omission 语义签名一致。全套项目测试 **53 pass / 0 fail**；Node 面板/服务语法检查通过；git diff --check 通过（仅有工作区既有 LF→CRLF 警告）；本地 Markdown 链接 118 条全部有效；Compose 配置有效，两个 Broker 在固定摘要镜像下运行并报健康。8 个凭据/运行时/实验 profile 路径均确认被忽略。全程仅连接本机隔离 Broker，未连接外部目标；未读取凭据。

**未完成/风险：** Docker 容器当前仍运行并恢复到 naive 演示 ACL；保留 AGH home 不存在，独立实验 profile 的 daemon 启动在 ready 前失败，4181 无监听，因此新版面板尚未安装审核或真实渲染，也未启动 Agnes 会话。第二套 AGH、演示视频和比赛提交包仍待做。MQTT 3.1.1 发布拒绝证据路径限制仍在，当前保守归 unknown。

**阻塞原因：** AGH UI 验证目前阻塞在独立 daemon 在 ready 前退出；真实模型会话还需要该环境自己的官方 Agnes Key。保留 home 缺失，不能把 CLI/面板静态检查冒充真实会话。

**下一步：** 完成全套测试、空白与文档链接检查；确认本地 Broker 留在可演示的 naive ACL 配置。然后准备隔离 AGH 演示环境，安装/审核新版插件并验证面板渲染与真实 Agnes 工具闭环，再录制 3–5 分钟视频、完成提交包脱敏。

## 隔离 AGH 恢复与最终面板包安装（2026-10-09）

**任务：** 继续昨日面板部署与 Docker 故障处理；将会话轨迹版面板实际更新到隔离 AGH。

**负责人：** 本次执行助手。

**修改目录：** `plugins/agh/README.md`、`AGENTS.md`、`docs/progress.md`；隔离 profile `.local/env/agh-demo/home` 的 AGH 包与 client module 运行状态。未修改 AGH 上游源码、日常用户 profile、系统配置或 Docker 数据。

**跨目录修改原因：** 用户要求继续交付 UI 和 Docker；AGH profile 属本地运行态，进度与协作状态文档需同步实际安装情况。

**已完成：** 使用仓库内隔离 profile 启动 AGH Web（`127.0.0.1:4181`，服务进程保持运行）；通过 AGH 管理流程对工作区插件执行 inspect/update/enable。当前版本 `sha256-233600f249a03fde26d02aefcde8ef8a36db46d19a8d563cf59f22bcdf9ccd72`，`trusted=true`、`desired=enabled`、`actual=running`、无 blockers；client-module roster 登记 `rightbar.session`、`mqtt.audit.latestresult` 和后端服务行。新版包现在确实安装在此隔离 profile，不再是仅有源码。

**验证命令与结果：** AGH 启动进程未退出、4181 出现监听、stdout 返回 `http://127.0.0.1:4181/`；`& '.local\update-panel.ps1'` 的 inspect/update/enable 完成，脚本随后核验包运行态和当前 integrity；读取 `.local/env/agh-demo/home/data/daemon/client-modules/local-dev/_client-modules.json` 确认 `rightbar.session` 与服务绑定。`npm test` → **62 pass / 0 fail**（沙箱内首次运行的 symlink 用例被 `EPERM` 拦截，获准在沙箱外重跑后通过）；`node --check .../client/index.js` 和 `git diff --check` 通过。未启动 Agnes 模型会话。

**未完成/风险：** 当前浏览器需要刷新以载入新 client module；尚未在会话中实际运行 MQTT 工具，因此不能声称真实报告已显示，也没有真实 Agnes 会话闭环证据。Docker Desktop 仍未启动；原目录仍含零字节 `engine.sock` 重解析点，管理员启动脚本返回退出码 1 且没有生成结果日志，未改变原目录。另有一个既存备份目录 `docker-secrets-engine.backup-20261008-223424`，本批没有触碰；Docker 服务不可用，Broker 部署闭环未复验。

**阻塞原因：** Docker socket 目录位于用户本地 AppData；直接目录改名返回 Access denied，管理员启动脚本也未成功执行（未能确认 UAC 是否获批）。面板真实轨迹显示还需要模型配置的会话；本次没有读取或配置模型凭据。

**下一步：** 刷新 `http://127.0.0.1:4181/` 查看右侧可折叠面板；新建会话运行固定 MQTT 目标并检查其结构化报告。Docker 请先退出错误窗口，再在管理员 PowerShell 执行 `& '<项目工作区>\.local\repair-docker-secrets.ps1'`；脚本保留旧 socket 目录作为备份，不删除 Docker 数据。Docker 恢复后运行部署环境 `up/check/audit`。

## Docker 恢复后的部署与网络模板修正（2026-10-09）

**任务：** Docker Desktop 恢复后完成本地部署；修复部署模板实际不发布回环端口的问题并执行固定案例审计。

**负责人：** 本次执行助手。

**修改目录：** `cli/environment.mjs`、`tests/cli/environment.test.mjs`、`README.md`、`docs/architecture.md`、`docs/deployment.md`、`AGENTS.md`、本进度文档；只重建本项目 `.local/reproducible` Compose 环境。没有触碰其他项目容器、用户数据卷或模型凭据。

**跨目录修改原因：** Docker 实测发现旧模板用 `internal: true` 网络时，容器处于运行状态但端口没有宿主映射，CLI 无法连接；运行脚本、边界测试和网络说明需要统一修复。另修正 Windows bind mount 下 Mosquitto 密码文件的 Unix 权限。

**已完成：** 用户告知 Docker 已修复。Docker Desktop/Engine 版本 `29.8.0`。停止并重建的只有本次 `mqtt-audit-reproducible` Compose 项目，`compose down` 未传 `-v`，原有三个项目数据卷保留。模板改用彼此分开的 `source`/`target` bridge 网络、关闭 `enable_ip_masquerade`，两端端口仍显式绑定 `127.0.0.1`；不再错误声称 `internal: true` 可同时提供宿主发布端口。合成 Mosquitto password 文件在容器内属主 `1883:1883`、权限 `0600`，修复了首次启动时“world readable”警告。

**验证命令与结果：** `docker compose ... config --quiet` 通过；`node cli/environment.mjs up --name reproducible` 两侧 readiness 均为 `witness-received-message`；`check` 两侧均通过；Docker `ps`/`compose port` 确认运行容器端口分别为 `127.0.0.1:11883` 与 `127.0.0.1:2883`，Windows TCP 检查均可连通；网络 inspect 显示两个网络 `internal=false`、masquerade=false。另用全新临时合成目录验证首次哈希阶段 `root:root 0600` 无 `mosquitto_passwd` 警告，随后切为运行用户 `1883:1883 0600`；临时目录已删除。`audit` 生成 `run-1791535863470-01195937`：overall=`fail`，`c3 target` 实际送达，导致业务要求失败；权限扩大计数 0、业务受损计数 0；c2/c3-source/c7-source/c8 两端等 6 项保守标为 unknown。该 naive 样例的失败是预期展示结果，不把源端未送达误报成拒绝。`npm test` → **63 pass / 0 fail**；脚本与测试 `node --check` 通过；`git diff --check` 通过（仅工作区既有 CRLF 提示）。

**未完成/风险：** bridge 网络关闭 IP masquerading 但仍是非 internal 网络，因此文档只承诺工具连接回环地址、Broker 网络彼此隔离，不声称容器无法路由到宿主或任何外部地址。AGH 管理 API 复核最终包 integrity 为 `sha256-233600f249a03fde26d02aefcde8ef8a36db46d19a8d563cf59f22bcdf9ccd72`、trusted/running，Web 200；真实 Agnes 模型会话和面板显示该次 runId仍未验收。运行 AGH 工具前还需确认其 daemon 环境变量 `MQTT_AUDIT_CREDS` 指向 `.local/reproducible/creds.json`，因为该部署使用独立合成账号。第二套 AGH 验收和比赛材料尚未完成。Docker 中既有停止容器没有被本次命令启动或删除。

**阻塞原因：** 本批 Docker 和本地 Broker 部署已不阻塞。真实 AGH 模型运行仍需由目标演示环境提供官方 Agnes provider，并需用户在浏览器创建会话后验收；本次未读取密钥或启动模型会话。

**下一步：** 在 `127.0.0.1:4181` 刷新 AGH；在 AGH 启动进程环境设置 `MQTT_AUDIT_CREDS` 为 `<项目工作区>\.local\reproducible\creds.json` 后新建会话，输入“验收本地 Mosquitto 到 EMQX 的 ACL 迁移，说明风险和证据。”核对真实工具轨迹的 `runId` 与右侧面板一致。最后完成第二套 AGH、演示视频与提交材料。
