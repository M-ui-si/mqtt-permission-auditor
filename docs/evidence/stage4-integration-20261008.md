# 阶段 4 记录：新判定语义下的本地 Broker 集成（2026-10-08）

本批在本机隔离环境使用合成身份、主题、口令和消息，重跑 Mosquitto 2.1.2 → EMQX 6.3.1 固定案例。Docker 镜像摘要、隔离设计和许可边界见[环境版本记录](../environment-versions.md)。原始 JSON 报告保存在被忽略的 .local/env/，本页只记录核对后的摘要。

## 环境

- Docker Engine 29.8.0；Compose 项目 mqttaudit；Mosquitto 与 EMQX 位于独立网络，仅宿主回环端口发布。
- Windows 的 TCP 排除范围包含 1883，绑定 127.0.0.1:1883 实际失败。将本机 Compose 映射改为 Mosquitto 127.0.0.1:11883 → 容器 1883；EMQX 为 127.0.0.1:2883 → 容器 1883。端口变化同步到固定本地实例注册表和 CLI 默认示例。
- EMQX 健康检查返回节点 6.3.1 is started；两侧 Broker 健康检查及 MQTT 往返通过。

## 三类样例

| 类型 | 样例与实际观测 | 汇总结果 |
| --- | --- | --- |
| 正常 | 从固定案例 c1 派生单项 smoke：device-sensor 发布 telemetry/up；源端和目标端见证者都实际收到消息 | 两端业务要求均通过，overall=pass，退出码 0 |
| 边界 | 停止 EMQX 后运行完整固定案例集；目标端 8 项均为 broker-unavailable，恢复后重跑 omission 档案 | 停机轮 overall=unknown，退出码 2；不计权限扩大或业务受损。恢复轮签名与停机前逐项及汇总一致 |
| 失败 | naive ACL 下 c3 device-sensor 发布 factory/admin/secret，目标端见证者实际收到；源端未送达没有明确主题级拒绝证据 | c3 业务要求失败、overall=fail，但不计为已证实权限扩大；c2/c8 发布未送达均为 unknown |
| 失败（拒绝证据） | omission ACL 下，业务必需的 c5 ops-admin 订阅 factory/#；目标端返回 SUBACK 0x80 | 业务受损与要求失败均有主题级拒绝证据；overall=fail |

修复 ACL 后把具体 deny 放到宽泛 allow 之前，c3 两端都未送达；依据 MQTT 3.1.1 的证据边界，目标端仍为 unknown，不能报“拒绝”或“通过”。c4/c5/c6 正向送达均通过；完整案例总体为 unknown，权限扩大为 0。该结果明确展示了当前发布拒绝证据的限制。

## 实际运行与复核

固定案例集通过 CLI 对两个本地回环端点运行，参数为 Mosquitto 127.0.0.1:11883、EMQX 127.0.0.1:2883、合成凭据文件 .local/env/creds.json、fixtures/cases/migration-baseline.json。报告路径包括：

- .local/env/stage4-report-naive.json
- .local/env/stage4-report-omission.json
- .local/env/stage4-report-target-stopped.json
- .local/env/stage4-report-recovered.json
- .local/env/stage4-report-corrected.json
- .local/env/stage4-report-normal-smoke.json

恢复轮用 Node 程序比较 omission 与 recovered 报告中的汇总、每项 sides、requirement、expansion 和 damage，签名一致。正常 smoke 的退出码为 0；停机边界为 2；naive/omission 失败为 1；ACL 修复后的完整固定集因仍有无法判定项退出码为 2。

## 判定范围与未完成项

- 真实 Broker 验证确认：送达可以支撑 allow；SUBACK 0x80 可以支撑订阅拒绝；连接失败、PUBACK 但未送达、无明确订阅拒绝证据均不会被升级成 deny。
- 本批未引入 Broker 日志读取，也未声称 MQTT 3.1.1 发布拒绝可被精确识别；CONNACK 4/5 离线语义由单测覆盖，未在此批伪造主题 ACL 证据。
- 阶段 4 的单测、插件契约、Broker 集成与三类样例已完成。后续已在隔离 AGH profile 安装、授信、启用插件并登记 client module；工作台活动会话中的面板真实渲染、第二套 AGH 真实 Agnes 会话、演示视频及提交包仍待完成。本地 CLI 报告不替代 AGH 执行记录。
