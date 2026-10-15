# 环境准备方案（Windows）

状态：**已执行（2026-10-07）**。镜像摘要、隔离布局与实测行为见 [环境版本记录](../environment-versions.md)，执行命令与结果记录在 [进度](../progress.md) 的"环境批次执行记录"一节。本页保留为可照做的准备说明；执行时未发生计划外安装或系统设置修改。

> 本页写作时区分了"已核实事实"与"待本机确认项"；全部确认项已在环境批次完成核验。

## 范围

为首个场景 Mosquitto → EMQX 文件 ACL 迁移验收准备本地隔离 Broker 环境：Docker Desktop（WSL 2 后端）、两个固定摘要的候选镜像、仅绑定回环端口的 Compose 隔离。不覆盖云平台、远程托管或生产环境；边界见 [架构](../architecture.md)。

## 已核实事实（2026-10-07）

### 本机实测

以下为编写本页当天的只读检查，未改变任何系统状态：

| 检查项 | 命令 | 结果 |
| --- | --- | --- |
| Docker 客户端 | `docker --version` | 已安装 `Docker version 29.8.0`，路径 `docker` |
| Compose 插件 | `docker compose version` | `v5.5.1` |
| Docker context | `docker info`（客户端段） | `desktop-linux`；另带 buildx v0.37.1 等插件 |
| WSL 状态 | `wsl.exe --status` | 默认分发 `docker-desktop`，默认版本 2；提示本机不支持 WSL1 |
| WSL 发行版 | `wsl.exe -l -v` | `docker-desktop` 存在，状态 `Stopped` |
| Docker 守护进程 | `docker version --format 'server={{.Server.Version}}'` | 不可达：`npipe:////./pipe/dockerDesktopLinuxEngine` 不存在，即 Docker Desktop 未启动 |
| mosquitto / emqx 客户端 | `command -v mosquitto mosquitto_pub emqx` | 均不存在 |
| Node | 以 `package.json` 的 `engines` 声明为准 | `>=24.10` |

结论：**Docker Desktop 已安装且 WSL 2 前置已就绪**。这与早期复核结论"本机未发现 Docker"不一致，可能因当时检查环境的 PATH 不同；以本页实测为准。剩余工作主要是启动 Docker Desktop、拉取镜像并固定摘要，不是从零安装。

### 公开来源核实

本机当时无法直连 Docker Hub API（直连与代理抓取均超时），以下经公开搜索佐证，**执行批次拉取前必须复核**：

| 事项 | 公开信息 | 执行时动作 |
| --- | --- | --- |
| `eclipse-mosquitto:2.1.2-alpine` 标签 | 多个第三方部署引用该标签；2.1.x 版本号标签仅发布 `-alpine` 后缀 | 以 [官方标签页](https://hub.docker.com/_/eclipse-mosquitto/tags) 复核存在性与摘要 |
| `emqx/emqx:6.3.1` 标签 | EMQX 6.3 为 LTS 线（2026-09 公告），6.3.1 为其补丁版本 | 以 [官方镜像页](https://hub.docker.com/r/emqx/emqx) 复核标签与摘要 |
| EMQX 许可 | 公开资料显示自 5.9.0 起由 Apache 2.0 改为 BSL 1.1：单节点一般无需许可 Key，多节点集群需要；5.8.x 及更早仍为 Apache 2.0 | 镜像仅用于本地单节点测试，不随项目分发、不组建多节点；若需 Apache 2.0 可评估退回 5.8.x 标签（届时核实最后的 Apache 标签） |
| Mosquitto 许可 | EPL/EDL 双许可 | 本地测试用途无额外限制 |
| Mosquitto 2.1 变更 | 2.1.0（2026-01 发布）弃用 `acl_file` / `password_file`，改由内含相同代码的插件选项承载，计划 3.0 移除 | 本项目首个场景正是文件 ACL：需实测 2.1.2 对 `acl_file` 的接受度与告警；若受阻退回 2.0.x 标签并在记录中说明 |
| Docker Desktop WSL 2 后端 | 官方文档说明系统要求与 WSL 2 后端支持 | 已安装则只核验版本；订阅条款按官方说明确认本机用途属免费范围 |

## 待本机确认项

执行环境批次时逐项确认，每项记录命令与输出：

1. 启动 Docker Desktop 后守护进程可达，能完成一次 `docker run --rm hello-world` 级别的拉取与运行（镜像来自公共 Docker Hub，不涉及真实业务或第三方 MQTT 目标）。
2. 磁盘剩余空间与内存足以同时运行两个 Broker 容器。
3. 计划端口在本机空闲：11883（源）、2883（目标映射）及 EMQX 管理/状态端口（默认 18083，若启用）。Windows 本机将 1857–2256 等范围列为 TCP 排除端口，1883 落在排除范围内，故项目采用 11883。
4. 两个候选镜像 `linux/amd64` 平台摘要可获取、镜像可拉取。
5. Mosquitto 2.1.2 加载 `acl_file` 与 `password_file` 的实际行为（接受、告警还是拒绝启动）。
6. EMQX 6.3.1 文件授权语法、认证方式与未命中授权链（no-match）的实际行为。
7. Docker Desktop 订阅条款对本机用途的适用性（个人、教育或小团队免费范围）。
8. 检查目标 AGH profile 中是否有其他插件干扰，并在接入前核验插件状态。

## 前置检查（只读，执行批次第一步）

```powershell
wsl.exe --status
wsl.exe -l -v
docker version
docker compose version
Get-NetTCPConnection -LocalPort 11883,2883 -ErrorAction SilentlyContinue
Get-PSDrive C | Select-Object Name,Free
```

任何一项异常先记录再决定是否继续，不跳过检查直接部署。

## 安装与版本核验（仅缺失时执行）

本机已具备 Docker Desktop 与 WSL 2，默认无需安装。若确需重装或修复，以官方 [Windows 安装说明](https://docs.docker.com/desktop/setup/install/windows-install/) 与 [WSL 2 后端说明](https://docs.docker.com/desktop/features/wsl/) 为准；安装属于改变系统状态的动作，须在执行批次中另行获得授权并记录，不属于本计划文档批次。任何镜像与工具均禁止使用浮动 `latest`。

## 镜像固定方法

执行批次获取并记录镜像身份，然后才允许编写 Compose 文件：

```sh
docker manifest inspect eclipse-mosquitto:2.1.2-alpine
docker manifest inspect emqx/emqx:6.3.1
```

- 记录 `linux/amd64` 平台摘要，写入环境版本记录（建议新增 `docs/environment-versions.md` 或证据目录条目），字段：镜像、标签、摘要（digest）、获取日期、许可结论。
- Compose 与脚本一律以 `镜像@sha256:<摘要>` 固定；标签仅作人类可读备注。
- 标签不存在、摘要与公开信息不符或许可结论变化时，停止并上报负责人，不得自动改用 `latest` 或相近版本。
- 许可边界：EMQX BSL 1.1 下仅本地单节点测试，不做多节点集群，不分发镜像；Mosquitto EPL/EDL 无此限制。备选标签：EMQX 5.8.x（Apache 2.0）、Mosquitto 2.0.x（`acl_file` 未弃用），选用前同样固定摘要并记录原因。

## Compose 隔离设计（草案，实现批次评审后落地）

- 独立 Compose 项目名（如 `mqttaudit`）；两个 Broker 分属不同 network，不与宿主其他容器网络互通。
- 端口仅绑定回环：源 `127.0.0.1:11883:1883`，目标 `127.0.0.1:2883:1883`；不使用 host network，不发布到非回环地址。
- EMQX Dashboard 仅在需要调试时启用，绑定回环并使用一次性合成口令，用后关闭。
- 配置与 ACL 文件以只读方式挂载进容器；数据卷使用项目前缀，便于整批清理。
- 合成凭据：Mosquitto 用容器内 `mosquitto_passwd` 生成本地口令文件；EMQX 用其引导机制创建内置数据库合成用户。凭据只存放在被 Git 忽略的本地目录，落盘后用 `git check-ignore` 逐项验证。
- 资源限制：为两个服务设置内存上限与日志大小上限，避免影响宿主。
- 全部账号、口令、主题与消息内容为合成数据，不含真实账号、真实业务主题命名或生产流量。

## 启动、健康检查与清理（已按实际执行修正）

```sh
docker compose -p mqttaudit up -d
docker compose -p mqttaudit ps
# 源端探活：容器内自带客户端完成一次合成发布-订阅往返
docker exec mqttaudit-mosquitto mosquitto_pub -h 127.0.0.1 -t health/ping -m ping -u <合成用户> -P <合成口令>
# 目标端探活：容器内官方状态接口（注意不是对 2883 发 HTTP——那是 MQTT 映射端口）
docker exec mqttaudit-emqx emqx ctl status
# 目标端同样做一次合成 MQTT 往返（可用源端镜像临时容器充当客户端）
docker compose -p mqttaudit logs --tail 100
docker compose -p mqttaudit down -v
```

就绪判据是"实际完成一次发布-订阅往返"或"官方状态接口返回 `is started`"，容器状态为 running 不等于就绪。实际执行记录（含输出）见 [环境版本记录](../environment-versions.md) 与 [进度](../progress.md) 环境批次一节。探活、日志与清理的命令和输出全部进入当批记录。

## 失败替代路线（Linux Docker 主机）

若 Docker Desktop 或 WSL 2 在本机确认不可用：

1. 首选：在本机 WSL 2 发行版内直接运行 Docker Engine，承载同一套 Compose 文件（仍属本地环境，安装动作单独授权）。
2. 次选：另一台本地 Linux 物理机或本机虚拟机承载，端口与隔离要求不变。
3. 约束：替代主机仍只承载本地隔离 Broker 与合成数据；不经负责人批准不把测试部署到第三方托管环境。
4. 迁移记录：替代主机的系统版本、内核、Docker 版本、镜像摘要与命令输出同样完整记录。

## 验收门槛（环境批次完成判据）

- 两个 Broker 以固定摘要镜像运行，端口仅回环可见，健康检查按上述判据实际通过。
- 凭据、ACL 与 Compose 相关本地文件确认被忽略或仅含合成数据。
- `docker compose down -v` 后端口释放、无残留容器与卷。
- 全部命令与输出已记录；未发生计划外安装、系统设置修改或模型启动。

## 关联文档

- [部署指南](../deployment.md)：AGH、Node 与运行准备。
- [研发计划](development-plan.md)：本方案对应阶段 0。
- [比赛要求备忘](../competition.md)：截止时间对环境批次的约束。
