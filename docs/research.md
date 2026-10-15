# 查重调研与项目差异

整理日期：2026-10-07。以下来自公开论文、仓库和官方文档的静态调研，未运行竞品，也未完成用户访谈。不能确认“没有人做过”，不能宣称技术首创；公开搜索无法覆盖未公开系统、商业内部功能或后续更新。

## 已有相关工作

| 项目 / 来源 | 公开描述与本项目的关系 |
| --- | --- |
| [MQTTactic](https://github.com/CGCL-codes/MQTTactic) | 针对 MQTT 实现的静态分析、符号执行与模型检查，包含授权问题。说明 MQTT 权限分析本身已有研究。 |
| [MBFuzzer，USENIX Security 2025](https://www.usenix.org/conference/usenixsecurity25/presentation/song-xiangpu) | MQTT 多方交互差分模糊测试，结合大模型辅助。说明跨实现差分测试和大模型结合并非首创。 |
| [mqtt-acl-linter](https://github.com/visoar/mqtt-acl-linter) | ACL 静态检查；其说明限制了运行时行为、优先级及继承验证能力。需要将实际 Broker 行为验收与文本检查区分。 |
| [MQTTSA](https://github.com/stfbk/mqttsa) | MQTT 安全评估和配置问题报告，与权限误配检测有交集，公开介绍的主线不是迁移前后验收。 |
| [pytest-mqtt](https://github.com/mqtt-tools/pytest-mqtt) | 提供 MQTT 测试夹具与消息测试能力，可作为测试基础能力参考，不代表端到端迁移验收已经完成。 |
| [fss-mqtt-broker](https://github.com/mbilling/fss-mqtt-broker) | README 宣称包含迁移、配置及 ACL 转换能力，与选题直接邻近。详细迁移文档未取得可核验内容，不能排除更深功能重叠。 |

结论是已有多类相邻解决方案，不能使用“无人做过”作为立项依据。目前拟验证的产品差异是：将迁移前后真实 Broker 行为、独立业务要求、三态结论、可复现证据和 AGH 驱动的反馈复测组织成可独立使用的开源验收流程。这只是目标定位，尚未实现，也不构成独占技术主张。

## 痛点与首个可检验假设

[Mosquitto ACL 文件插件文档](https://www.mosquitto.org/documentation/plugins/acl-file/)描述 deny 规则优先于 grant 处理；[EMQX 文件授权文档](https://docs.emqx.com/en/emqx/latest/guides/access-control/authz/file.html)描述自上而下匹配、命中后停止。由此提出待复现假设：把“允许发布 `factory/#`、拒绝发布 `factory/admin/#`”迁移为目标端先宽泛允许、后拒绝的规则，可能造成权限扩大。

该假设已于 2026-10-07 在固定版本（`eclipse-mosquitto:2.1.2-alpine`、`emqx/emqx:6.3.1`）的本地隔离环境实测复现：Mosquitto 的 deny 与书写顺序无关，EMQX 按自上而下首条命中，"允许在前、拒绝在后"的直译会造成权限扩大；另发现 Mosquitto `topic deny` 限定词语法陷阱与两端"发布被拒仍报成功"的信号陷阱。证据与配置见 [阶段 1 差异复现记录](evidence/stage1-acl-difference-20261007.md)，结论仅覆盖所测版本与配置。

[EMQX 的 Mosquitto 迁移说明](https://docs.emqx.com/en/emqx/latest/get-started/migration/migrate-from-mosquitto.html)覆盖迁移中的配置与 ACL 处理，说明验收要衔接现有迁移流程。[Yandex IoT 迁移教程](https://yandex.cloud/en/docs/iot-core/tutorials/iot-core-migration)提示借助接收侧及 Broker 日志核查消息行为；客户端调用成功本身不足以证明业务实际可用。

## 尚待确认

- ~~在固定版本的本地实例上，最小规则优先级案例是否可复现。~~ 已于 2026-10-07 复现证实，见 [阶段 1 证据](evidence/stage1-acl-difference-20261007.md)。
- 相邻迁移工具是否已提供同等的业务要求验收和运行时差异证据，需要进一步查文档与实际试用。
- 开发者对配置接入成本、报告形式和 CI 使用方式的真实需求。
- 首版支持的语法范围及无法判定边界，避免泛称支持所有 MQTT ACL。
