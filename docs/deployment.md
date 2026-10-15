# 本地部署与验收

仅运行合成案例，固定端口为 `127.0.0.1:11883` 和 `127.0.0.1:2883`。不要把脚本用于生产 Broker。模板位于 [deploy](../deploy/README.md)，命令入口为 [environment.mjs](../cli/environment.mjs)。

## 前提

- Node.js **24.10 或更高版本**（`node --version`）。本工作区保留的版本可直接使用 `./.tools/node24/node.exe`；系统 PATH 中的 Node 可能仍为 22，不要混用。
- 已启动的 Docker Desktop / Docker Engine，Linux 容器模式，Compose v2 或兼容版本。
- 两个回环端口空闲。新旧环境使用相同固定端口，不能同时运行；脚本不会停止其他 Compose 项目。
- 首次启动需要本地已有或能够拉取固定摘要镜像，见 [环境版本](environment-versions.md)。EMQX 仅用于本地单节点测试，本项目不重新分发镜像。

核心与环境脚本无 npm 第三方依赖，不需要 `npm install`。

## 新机器运行

在仓库根目录执行：

```sh
npm run env:init
npm run env:up
npm run env:check
npm run env:audit
```

`init` 生成 `.local/env/` 中的配置和每次独立的合成口令；凭据不输出到终端，不进入 Git 或插件包。`up` 在固定 Mosquitto 镜像中生成口令摘要，然后启动两个互不相连的 user-defined bridge 网络中的 Broker。Docker 的 `internal: true` 网络不接入宿主机网卡，不能满足这里由宿主机通过回环端口访问 Broker 的需要；因此本模板关闭 bridge 的 outbound IP masquerading，并且只将 MQTT 端口发布到 `127.0.0.1`，不发布 EMQX 管理后台。测试程序只连接这两个本地回环端口，不访问外部目标。

`check` 使用 device-sensor 发布独立随机标记，由 auditor 实际接收；不能只靠端口开放或 PUBACK 判为健康。`up` 会等待启动并重试此检查。健康不等于 ACL 验收通过。

`audit` 运行 c1–c8，将报告写入该环境的 `agh-runs/` 并打印摘要。默认 `naive` 故意保留错误规则顺序，因此**预期退出码为 1**：c3 目标端实际送达违反业务要求。源端未送达属于 unknown，不能声称已证实权限扩大。

退出码：0 就绪或验收通过；1 验收发现失败；2 未就绪或验收无法判定；3 参数、配置或 Docker 命令错误。

停止本脚本创建的 Broker（保留卷、配置及报告）：

```sh
npm run env:down
```

不提供自动删除或重置凭据功能。保留数据卷时不得单独替换凭据文件；EMQX bootstrap 用于初始化空数据库，不是已有用户的口令轮换工具。

## 已有本机环境

现有 `.local/env` 没有本脚本的 `environment.json` 标记时，脚本拒绝接管或覆盖。要复验新部署，先按旧环境的启动方式停止它，再创建独立目录：

```powershell
# 在本工作区直接用保留的 Node 24；以下不会覆盖旧 .local/env。
& ./.tools/node24/node.exe cli/environment.mjs init --name demo
& ./.tools/node24/node.exe cli/environment.mjs up --name demo
& ./.tools/node24/node.exe cli/environment.mjs check --name demo
& ./.tools/node24/node.exe cli/environment.mjs audit --name demo
& ./.tools/node24/node.exe cli/environment.mjs down --name demo
```

若 init 报目录已存在，核实目录后继续使用该环境的 up/check；不要反复初始化。脚本只识别自身生成的环境标记与 Compose 模板，不接管历史 Compose。目录名禁止路径分隔符，拒绝 symlink/junction。

可以首次初始化时选择 `--variant corrected` 或 `--variant omission`。切换档案应停止当前环境并使用新名称创建另一环境；不修改正运行实例的 ACL。`corrected` 的完整案例总体预期为 unknown；`omission` 的 c5 可给出业务受损证据。

## AGH 插件与 Skill

AGH 本身需在目标机器独立安装，运行要求与固定版本见[运行说明](../运行说明.md#agh-网页界面及插件)和 [AGH 获取说明](../vendor/README.md)。通过 AGH 官方界面配置该环境自己的官方 Agnes Key；不要复制其他机器的 home、会话、缓存或凭据。

1. 以本仓库作为 AGH 工作目录。合成凭据优先使用有效的 `MQTT_AUDIT_CREDS`，其次是当前成品的 `.local/reproducible/creds.json`，最后是默认 `.local/env/creds.json`。若用了 `--name demo`，在**启动 AGH 的进程环境**设置 `MQTT_AUDIT_CREDS` 为本机 `.local/demo/creds.json` 的绝对路径；该变量只指定合成 Broker 凭据，不能指向模型凭据。AGH 宿主可能隔离插件环境变量，启动后应以健康查询实际写入的运行目录与送达结果确认生效，不能只凭启动命令推断。不要切换文件后让已运行的 daemon 继续使用旧环境。
2. 打开 AGH 插件管理 → 从来源安装 → 本地文件，选择 `plugins/agh/mqtt-audit-tools`。相对来源为 `file:./plugins/agh/mqtt-audit-tools`；工作目录不同时使用该文件夹的绝对来源。
3. 核对 inspect 预览中的包名、完整性摘要及能力，按官方流程安装、授信并启用。旧版本应执行更新，不能只修改源文件就认为已安装快照已改变。
4. 核实包为 running，三个 MQTT 工具可发现；Skills 中 `mqtt-migration-audit` 为 ready；右侧面板已加载。本包同时包含工具、Skill 和 client module，**无需另装 MCP 服务器**。
5. 刷新浏览器并新建会话，输入：**验收本地 Mosquitto 到 EMQX 的 ACL 迁移，说明风险和证据。**
6. 核对真实轨迹确有 Agnes 的工具调用，返回 `runId` 与面板相同；新开另一个未运行会话应为空，不能显示前一个会话的结论。切回原会话仍可读取原结果。

面板只展示当前会话通过插件运行的结果。独立 CLI 报告和更新前未绑定会话的历史结果不会自动显示；它们仍保留在原目录。启动失败、运行中和证据不足各自明确显示。

## 最终成品范围与演示检查

当前工作区与隔离 `local-dev` AGH profile 即为本项目最终成品，不安排向第二套 AGH 平移或安装。交付前仍需在当前 AGH 中完成真实 Agnes 会话验收，记录包摘要、caseId、runId、结构化结果及脱敏工具轨迹；检查目标句、面板展开/收起/筛选和会话切换，再录制 3–5 分钟视频。离线单测及 CLI 报告不能替代真实会话证据。

2026-10-09 本机部署实测：Docker Desktop 29.8.0 下两个 Broker 均启动，MQTT 见证健康检查通过；naive 案例 overall=fail（c3 目标端实际送达，业务要求失败），源端发布未送达仍保守为 unknown。Docker `internal: true` 网络不接入宿主机，因此无法支持宿主机访问已发布端口；模板改用源/目标分离的 bridge 网络、关闭 outbound IP masquerading，并仅绑定回环端口。Mosquitto 合成 password 文件在容器内归 `1883:1883`、权限 `0600`。真实 Agnes 会话闭环仍待验证；第二套 AGH 不在当前成品范围内。
