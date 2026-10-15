# 环境版本记录

本页记录本地隔离 Broker 环境的镜像身份、许可结论与关键实测行为，供 Compose 固定引用与报告引用。运行文件位于被忽略的 `.local/env/`，不进入仓库。

## 镜像身份（2026-10-07 拉取并实测）

| 镜像标签 | 摘要（RepoDigest） | 许可（镜像标签声明） | 实测版本 |
| --- | --- | --- | --- |
| `eclipse-mosquitto:2.1.2-alpine` | `sha256:38c0da4f2ef84284d47b3b3eeea1cb3bdeabe81ee10caf0cd5c5ff61ee3ea408` | `EPL-2.0 OR BSD-3-Clause` | `mosquitto version 2.1.2` |
| `emqx/emqx:6.3.1` | `sha256:5ecbf93d04e34aaf4096af074e93b773d0838c8ea668cfabdec7976b272d9606` | `BSL-1.1`（标签 `org.opencontainers.image.edition: Enterprise`） | 启动日志 `EMQX Enterprise 6.3.1 is running now!`，`emqx ctl status` 报 `6.3.1` |

补充事实：

- EMQX 镜像基于 Debian 13，源码修订 `b0604926195f9372b0068b61f88d409d639a2401`；启动日志提示集群用途需申请许可（非营利或教育可咨询免费许可）。本项目仅本地单节点测试，不组建集群、不分发镜像。
- 平台：Docker Desktop，客户端与服务端 `29.8.0`，Compose 插件 `v5.5.1`，WSL 2 后端（`docker-desktop` 发行版）。
- 标签存在性此前仅公开搜索佐证，本机当时无法直连 Docker Hub API；2026-10-07 实际拉取成功即完成复核。

## 隔离布局

- Compose 项目 `mqttaudit`，定义在 `.local/env/compose.yaml`（被 `.gitignore` 的 `.local/` 覆盖，`git check-ignore` 已验证）。
- 端口仅回环：`127.0.0.1:11883`（Mosquitto 源端映射容器 1883）、`127.0.0.1:2883`（EMQX 目标端映射容器 1883）；EMQX Dashboard 的 18083 仅容器内监听，未发布。Windows TCP 排除范围包含 1883，2026-10-08 实测绑定失败后将源端改映射到 11883；该变化已同步本地实例注册表。
- 两个独立网络 `source` / `target`，两 Broker 互不可达；数据用命名卷，`down -v` 整批清除。
- 合成凭据：`health` 用户口令文件由固定摘要镜像的临时容器在挂载目录生成，仅存于 `.local/env/mosquitto/dynamic/`。

## 实测行为（阶段 1 输入）

以下为环境批次实测记录，不是文档推导：

| 观测 | 结果 |
| --- | --- |
| Mosquitto 2.1.2 加载 `password_file` | 接受；日志显示经 `builtin-security` 插件注册 `basic-auth` 事件，未见弃用警告 |
| passwd 文件缺失时启动 | 报 `password-file: Error: Unable to open pwfile` 并退出（退出码 13）——"服务未就绪"需判为无法判定的实例 |
| passwd 为 `0600 root` 时 | 以 `mosquitto` 用户运行无法读取，同样退出；放宽 `0644` 后可加载，但日志警告属主与属组非 mosquitto，未来版本将拒绝加载 |
| passwd 在哈希时为 `0600 root:root`、运行时为 `0600 1883:1883`（2026-10-09 新部署脚本实测） | `mosquitto_passwd` 与 Mosquitto 2.1.2 均正常读取；没有属主或 world-readable 警告，见证消息往返成功 |
| 错误口令连接 | 客户端收到 MQTT `Connection Refused: not authorised`，`mosquitto_pub` 退出码 5——源端认证确实生效 |
| 源端健康检查 | 认证发布-订阅往返成功（QoS 1，消息实际送达） |
| EMQX 6.3.1 开箱默认 | 匿名 MQTT 连接允许，发布-订阅往返成功——阶段 1 必须显式配置认证与授权链，不能依赖默认 |

## 命令速查

```sh
cd .local/env
docker compose -p mqttaudit up -d      # 启动（Mosquitto 依赖 passwd 文件，见上表）
docker compose -p mqttaudit down -v    # 整批清理（含卷）
```

重建 passwd（首次或口令更换时，哈希工具执行前先由 root 私有读取）：

```sh
MSYS_NO_PATHCONV=1 docker run --rm \
  -v "$(pwd -W)/mosquitto/dynamic:/mosquitto/dynamic" \
  --entrypoint mosquitto_passwd \
  eclipse-mosquitto@sha256:38c0da4f2ef84284d47b3b3eeea1cb3bdeabe81ee10caf0cd5c5ff61ee3ea408 \
  -b -c /mosquitto/dynamic/passwd health '<合成口令>'
```

哈希完成后将属主和权限设为 Mosquitto 运行用户可读（本地文件由容器挂载，不会访问网络）：

```sh
MSYS_NO_PATHCONV=1 docker run --rm --network none \
  -v "$(pwd -W)/mosquitto/dynamic:/generated" \
  --entrypoint sh \
  eclipse-mosquitto@sha256:38c0da4f2ef84284d47b3b3eeea1cb3bdeabe81ee10caf0cd5c5ff61ee3ea408 \
  -c 'chown 1883:1883 /generated/passwd && chmod 600 /generated/passwd'
```
