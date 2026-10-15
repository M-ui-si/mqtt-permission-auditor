# 阶段 1 差异复现记录：Mosquitto → EMQX 文件 ACL（2026-10-07）

本页为本地隔离环境实测记录，配置与数据全部合成。环境与镜像摘要见 [环境版本记录](../environment-versions.md)，运行文件在被忽略的 `.local/env/`。结论仅覆盖所列版本、身份、主题与动作。

## 结论摘要

1. **权限扩大假设在本环境证实**：同一"宽泛允许 `factory/#` + 具体拒绝 `factory/admin/#`"的意图，源端 Mosquitto 2.1.2 拒绝 `device-sensor` 发布 `factory/admin/secret`，目标端 EMQX 6.3.1 按"允许在前、拒绝在后"直译后**实际送达**了该消息。业务要求"`factory/admin/#` 仅 `ops-admin` 可发布"在目标端失败。
2. **两端拒绝语义不同**：Mosquitto 的 deny 与书写顺序无关；EMQX 自上而下首条命中。把具体拒绝移到宽泛允许之前即可在 EMQX 上恢复拒绝（顺序即修复），已实测验证。
3. **发布被拒在两端都表现为客户端成功**（`pub_exit=0`、无报错、静默丢弃）：判定必须依据消息实际送达观测或 Broker 日志，不能依据客户端返回。
4. 语法陷阱：Mosquitto 的 `topic deny` 占据 `read|write|readwrite` 的限定词位置；误写 `topic deny write <topic>` 时"write "被并入主题名，deny 指向不存在的主题且**无任何告警**。

## 环境

- 镜像：`eclipse-mosquitto@sha256:38c0…ea408`（2.1.2-alpine）、`emqx@sha256:5ecb…9606`（6.3.1，BSL-1.1，单节点）。
- 布局：Compose 项目 `mqttaudit`，源/目标独立网络，仅 `127.0.0.1:1883` / `127.0.0.1:2883`；清理 `down -v` 后无残留。
- 身份（全部合成，口令仅存 `.local`）：`device-sensor`、`ops-admin`、`guest-ro`、`no-rules-user`、`auditor`（只读见证账号）。
- 认证：Mosquitto `password_file`（容器内 `mosquitto_passwd` 生成，`0644`）；EMQX `built_in_database` + **bootstrap CSV**（`/opt/emqx/etc/auth-built-in-db-bootstrap.csv`，`bootstrap_type=plain`）——空卷重建后用户自动恢复，可复现性好。
- 探针：见证法——被测发布前先以 `auditor` 订阅同主题，以"是否实际收到"区分允许与静默拒绝；发布/订阅探针脚本存 `.local/env/stage1/probe_matrix.sh`。

## 配置（实测原文）

源端 Mosquitto ACL（顺序 A；顺序 B 仅把 deny 行移到 user 块首行）：

```text
user auditor
topic read #

user device-sensor
topic write telemetry/#
topic write factory/#
topic deny factory/admin/#

user ops-admin
topic readwrite factory/#

user guest-ro
topic read telemetry/#
```

目标端 EMQX ACL（朴素迁移顺序；修复顺序仅把 device-sensor 的 deny 规则移到其 allow 之前）：

```erlang
{allow, {username, "auditor"}, subscribe, ["#"]}.
{allow, {username, "device-sensor"}, publish, ["telemetry/#", "factory/#"]}.
{allow, {username, "ops-admin"}, all, ["factory/#"]}.
{allow, {username, "guest-ro"}, subscribe, ["telemetry/#"]}.
{deny, all, subscribe, ["$SYS/#", {eq, "#"}, {eq, "+/#"}]}.
{deny, {username, "device-sensor"}, publish, ["factory/admin/#"]}.
{deny, all}.
```

EMQX 授权固定：`no_match = deny`、`deny_action = ignore`、file 源（与 6.3.1 默认一致，显式钉住）。

## Phase A：EMQX 6.3.1 默认行为（未覆盖授权配置时）

| 探针 | 结果 |
| --- | --- |
| 生效授权配置 `emqx ctl conf show authorization` | `no_match=deny`、`deny_action=ignore`、file 源指向 `acl.conf`；镜像 acl 含 `{allow, {security_profile, legacy}}`，6.3 默认 hardened 下该兜底 allow 不生效 |
| 匿名连接 | CONNACK `not authorised`，客户端退出码 5 |
| 无规则命中的发布（`device-sensor` → `telemetry/up`） | `pub_exit=0` 无报错；因默认规则下无人有权订阅，外部无法送达观测，是否丢弃未取得直接证据（局限，Phase B 已由 `{deny, all}` + 见证法补齐同类观测） |
| 订阅 `#` | SUBACK 拒绝（客户端打印 "All subscription requests were denied." 但**退出码 0**），Broker 告警日志 `authorization_permission_denied` |

## Phase B：行为矩阵（源端为修正 deny 语法后的顺序 A）

`delivered=-` 表示见证订阅者未收到（判定为未实际送达）；两端 `pub_exit` 全部为 0。

| 探针 | 源端 Mosquitto 2.1.2 | 目标端 EMQX 6.3.1（朴素迁移） |
| --- | --- | --- |
| P1 device-sensor 发布 telemetry/up | 送达 | 送达 |
| P2 device-sensor 发布 factory/line1 | 送达 | 送达 |
| **P3 device-sensor 发布 factory/admin/secret** | **拒绝（未送达 + 日志 `Denied PUBLISH … 'factory/admin/secret'`）** | **送达（权限扩大）** |
| P4 ops-admin 发布 factory/cmd/run | 送达 | 送达 |
| P5 ops-admin 订阅 factory/# 并收到的发布 | 收到 | 收到 |
| P6 guest-ro 发布 factory/x | 拒绝（未送达 + 日志） | 拒绝（未送达；`{deny, all}` 静默丢弃） |
| P7 guest-ro 订阅 telemetry/up | 收到 | 收到 |
| P8 guest-ro 订阅 factory/# | 拒绝：客户端 5 秒超时退出（码 27），无 SUBACK 失败文本 | 拒绝：SUBACK 失败文本，退出码 0 |
| P9 no-rules-user 发布 telemetry/up | 拒绝（未送达 + 日志） | 拒绝（未送达，静默） |

EMQX 侧拒绝的日志证据（告警级）示例（P3 修复顺序后）：

```text
[warning] tag: AUTHZ … msg: authorization_source_denied … username: device-sensor,
  topic: factory/admin/secret, module: emqx_authz_file, action: PUBLISH(Q1,R0)
[warning] tag: AUTHZ … msg: cannot_publish_to_topic_due_to_not_authorized … reason: not_authorized
```

## 顺序对照

| 实验 | 结果 |
| --- | --- |
| Mosquitto 顺序 B（deny 行在前）发布 factory/admin/secret | 仍拒绝——deny 优先与书写顺序无关，与官方插件文档一致 |
| EMQX 拒绝前置（deny 规则先于 allow）发布 factory/admin/secret | 拒绝（未送达 + 上方双告警日志）——首条命中，顺序即修复 |

## 版本行为备忘（阶段 2 输入）

- Mosquitto 2.1.2：`acl_file`/`password_file` 可用，经 builtin-security 插件加载（`acl-check`/`basic-auth` 事件），**未见弃用警告**；acl/passwd 文件的权限与属主不合规只告警不拒绝（"未来版本将拒绝加载"）；`mosquitto_passwd -c` 拒绝覆盖已存在文件；拒绝发布时客户端仍收到 PUBACK 语义成功；拒绝订阅时客户端表现为超时而非明确失败文本。
- EMQX 6.3.1：默认 hardened（旧 legacy 兜底 allow 不生效）、`no_match=deny`；`deny_action=ignore` 静默丢弃被拒发布；订阅拒绝经 SUBACK 失败码告知但 `mosquitto_sub` 退出码为 0；发布与订阅拒绝均有 AUTHZ 告警日志可作二级证据；`emqx ctl users` 子命令已不存在，内置数据库用户走 bootstrap CSV。
- 对 core 判定器的直接要求：结论必须以"送达见证"为主证据、SUBACK/PUBACK 与客户端退出码不可作为允许依据、Broker 日志作印证；迁移转换器必须把 deny 类规则前置并显式收尾兜底，且必须校验 Mosquitto `topic deny` 的限定词位置语法。

## 复现方式

```sh
cd .local/env
docker compose -p mqttaudit up -d          # 空卷时 bootstrap CSV 自动建用户
docker exec -i mqttaudit-mosquitto sh -s < stage1/probe_matrix.sh
docker run --rm -i -e BROKER=mqttaudit-emqx --network mqttaudit_target \
  --entrypoint sh eclipse-mosquitto@sha256:38c0…ea408 -s < stage1/probe_matrix.sh
docker compose -p mqttaudit down -v
```

两次完整建拆循环（含一次取证复验）均无残留。
