# core

核心验证器（已实现首版，独立于 AGH 与模型运行，零第三方依赖，Node 24 + ESM）。

模块：

- `mqtt-client.mjs`：最小 MQTT 3.1.1 客户端（CONNECT/SUBSCRIBE/QoS1 PUBLISH/下行接收），供探针使用。
- `prober.mjs`：送达见证探针。允许的主证据是见证订阅者实际收到消息；主题级拒绝的唯一明确协议证据是 SUBACK 0x80。CONNACK 4/5 属连接建立阶段拒绝，不代表主题 ACL 拒绝；MQTT 3.1.1 的 PUBACK 不携带授权结果——两者均与"收到 PUBACK 但未送达"一样判"无法判定"（判决函数 `decidePublishVerdict` / `decideSubscribeVerdict` 为纯函数，可离线单测）。
- `runner.mjs`：健康门控、双端探针、三态聚合（通过/失败/无法判定，最坏优先）与维度汇总（权限扩大、业务受损、业务要求符合性）；入口处强制校验 Broker 地址为数字回环 `127.0.0.1`（先于任何健康检查与连接）。
- `report.mjs`：人读报告与机器可读 JSON 渲染。

结论语义见 [架构](../docs/architecture.md)：超时、连接失败、证据缺失与不支持语法只产生"无法判定"；发布被拒在 MQTT 3.1.1 无协议级证据，未送达一律"无法判定"；连接建立阶段拒绝（CONNACK 4/5）同样不冒充主题级拒绝。以上均不计为拒绝、通过、权限扩大或业务受损；Broker 不可用时该侧全部判"无法判定"。Broker 地址锁定 `127.0.0.1`。首版支持的检查动作：publish、subscribe；ACL 语义支持范围以 [环境版本记录](../docs/environment-versions.md) 与 [阶段 1 证据](../docs/evidence/stage1-acl-difference-20261007.md) 实测行为为准。
