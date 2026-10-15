# MQTT 权限迁移审计器

本项目用于验收 MQTT 平台迁移后的 ACL 权限。当前固定场景是 **Mosquitto → EMQX 文件 ACL 迁移**：分别在源端和目标端执行合成客户端操作，以消息是否被见证订阅者实际收到等协议证据，判断权限是否扩大、原有业务是否受损，以及权限是否符合独立定义的业务要求。

项目提供三种使用方式：Node.js 核心/命令行、Docker 本地 Broker 复现环境，以及供 Agnes Harness（AGH）调用的插件和只读结果面板。根目录的 `MQTT权限迁移审计器.exe` 是 AGH 网页界面的本地启动器；它不包含 Broker、AGH 上游程序或模型。

## 环境要求

| 用途 | 需要的环境 | 不需要的内容 |
| --- | --- | --- |
| 单元测试、核心与 CLI | Node.js 24.10 或更高版本；Windows、Linux 或 macOS 终端 | Docker、AGH、模型账户 |
| 本地 Broker 复现 | Node.js 24.10+；Docker Desktop（Linux 容器）或 Docker Engine；Docker Compose v2；11883 和 2883 回环端口可用 | AGH、模型账户 |
| AGH 工具、Skill 和面板 | 单独安装的 Agnes Harness；Node.js 24.10+；如需模型驱动会话，再配置官方 Agnes 模型账户 | 项目不提供 AGH、模型文件或模型凭据 |
| Windows 一键启动器 | Windows x64；Node.js 24.10+；可用的 AGH 固定版本源码/构建产物 | 启动器本身不打包 Node、AGH、Docker 或模型 |
| 重建 Windows EXE | Python、PyInstaller（当前构建验证为 Python 3.14.6 / PyInstaller 6.19.0） | 这只用于重新打包启动器，不是运行核心审计的要求 |

Windows 上先按 [Docker 官方安装说明](https://docs.docker.com/desktop/setup/install/windows-install/)安装 Docker Desktop；安装后启动 Docker Desktop，确保 Docker Engine 已就绪并使用 Linux 容器。Docker Desktop 已包含 Engine、CLI 和 Compose；其他 Linux 主机需准备 Docker Engine 与 [Compose 插件](https://docs.docker.com/compose/install/)。用后面的 `docker version` 和 `docker compose version` 命令确认安装。Docker 首次运行需要能获取项目固定摘要引用的镜像。EMQX 镜像是本地单节点测试用途，带有 BSL-1.1 许可；本项目不重新分发镜像。当前实测环境为 Windows 11、Docker Desktop、WSL2、Docker Engine 29.8.x 和 Compose v2。

项目没有 npm 第三方运行依赖，不需要 `npm install`。核心和 CLI 使用 Node.js 内置模块；AGH 插件的浏览器面板使用 AGH 提供的 React 运行时。

## 快速开始：测试和本地审计

在 PowerShell、Terminal 或其他 shell 中进入仓库根目录。运行测试和核心 CLI 只需 Node.js：

```sh
node --version
npm test
```

Node 版本必须为 24.10 或更高。若要启动后面的本地 Broker，还需确认 Docker 命令可连接正在运行的 Linux Docker Engine：

```sh
docker version
docker compose version
```

然后创建并运行本项目自己的隔离 Broker 环境：

```sh
npm run env:init      # 生成 .local/env/ 和随机合成凭据
npm run env:up        # 创建/启动 Mosquitto 与 EMQX，等待见证健康检查
npm run env:check     # 分别验证两端实际消息送达
npm run env:audit     # 执行固定 c1–c8 审计并输出报告
npm run env:down      # 停止本项目 Broker，保留文件、报告和数据卷
```

默认环境名称为 `env`，ACL 档案为 `naive`。如果 `.local/env` 已存在，初始化会拒绝覆盖；请保留并检查现有环境，或创建新名称：

```sh
node cli/environment.mjs init --name demo --variant corrected
node cli/environment.mjs up --name demo
node cli/environment.mjs check --name demo
node cli/environment.mjs audit --name demo
node cli/environment.mjs down --name demo
```

`--variant` 只用于 `init`，支持 `naive`、`corrected` 和 `omission`。切换档案需创建新环境，不能在现有运行实例上静默换 ACL。部署细节、网络边界和故障排查见[本地部署与验收](docs/deployment.md)。

### 预期结果与退出码

默认 `naive` 档案故意保留一条目标端授权过宽的规则，因此 `env:audit` **预期判定失败并以退出码 1 结束**；典型证据是 c3 消息在目标端实际送达，但独立业务要求规定只有 `ops-admin` 可执行该操作。这是审计发现，不代表程序启动失败。

环境命令的退出码为：`0` 就绪或验收通过，`1` 发现业务失败，`2` 未就绪或无法判定，`3` 参数、配置或 Docker 命令错误。`corrected` 也可能因现有协议无法证明拒绝而得到 `unknown`；不能将缺少送达证据说成拒绝已经证实。

合成凭据和报告留在被忽略的 `.local/<环境名>/`：凭据位于 `creds.json`，报告位于 `agh-runs/`。`env:down` 不删除这些文件或 Docker 卷。不要将 `.local/` 复制进 Git、插件包或公开材料。

## 运行 Windows AGH 界面

双击仓库根目录的 [`MQTT权限迁移审计器.exe`](MQTT权限迁移审计器.exe)。启动器自动启动或复用本机 AGH Web 服务，打开浏览器并在窗口中显示本地网址；窗口标题为“MQTT 权限迁移审计器”。运行环境、AGH 查找路径和停止行为见[运行说明](运行说明.md)。

启动器需要 Node.js 24.10+ 和 Agnes Harness 固定版本 `c4efd170547a225890664c1c186a7347399b53e0` 的 CLI 构建产物 `packages/cli/dist/local/agnes.mjs`。它查找包内 `vendor/agnes-harness/`、`AGH_SOURCE` 环境变量，或本机 `D:\AGH`。本包当前不含 AGH 上游源码，也不含 Node 运行时。模型账户须在 AGH 中自行配置；启动器不读取或复制其他 profile 的模型凭据。

## 在 AGH 中使用插件

AGH 必须单独安装并运行。打开 AGH 插件管理，从本地来源选择 `plugins/agh/mqtt-audit-tools`，核验包名与 integrity 后按官方流程安装、授信并启用。插件包含工具、Skill 和只读结果面板，不需要另装 MCP 服务器。使用插件连本项目 Broker 时，启动 AGH 的进程应设置 `MQTT_AUDIT_CREDS`，指向所选 `.local/<环境名>/creds.json` 的绝对路径；这是合成 Broker 凭据，与 Agnes 模型凭据无关。未设置时，插件按 `.local/reproducible/creds.json`、`.local/env/creds.json` 的顺序寻找默认文件。插件配置和验收步骤见[本地部署与验收](docs/deployment.md)及[插件说明](plugins/agh/README.md)。

## 安全边界与判定范围

- 开发、演示和自动化测试使用合成 ACL、合成身份和本地 Broker，不接入生产系统。
- Broker 隔离在两个独立 Docker bridge 网络，MQTT 端口仅绑定 `127.0.0.1:11883` 和 `127.0.0.1:2883`；EMQX Dashboard 不发布到宿主机。
- 验证器拒绝 `localhost`、域名、非回环 IP 和任意远程目标，只允许数字回环地址 `127.0.0.1`。
- 结论为“通过 / 失败 / 无法判定”三态。MQTT 3.1.1 的 PUBACK 不携带授权结果；发布未送达、超时或连接错误不能单独证明拒绝。
- 首版覆盖 publish、subscribe 探针和固定案例，不代表对任意 Broker、ACL 语法、QoS、身份体系或所有业务流量的完整形式化证明。

## 项目结构

| 路径 | 内容 |
| --- | --- |
| [`core/`](core/README.md) | MQTT 探针、三态判定、聚合和报告生成 |
| [`cli/`](cli/README.md) | 独立审计 CLI 和隔离 Docker 环境生命周期命令 |
| [`plugins/agh/`](plugins/agh/README.md) | AGH 工具、Skill 和只读结果面板 |
| [`fixtures/`](fixtures/README.md) / [`deploy/`](deploy/README.md) | 固定合成案例、Broker 与 ACL 模板 |
| [`tests/`](tests/README.md) | 核心、CLI、插件契约和边界测试 |
| [`docs/`](docs/README.md) | 架构、部署、证据、环境版本和项目进度 |

更完整的复现说明见[部署指南](docs/deployment.md)，项目功能和操作限制见[运行说明](运行说明.md)。
