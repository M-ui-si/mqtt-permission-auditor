# tests

当前测试（Node 24 内建 test runner，零依赖）：

```sh
npm test   # 或 node --test tests/core/*.test.mjs（见 package.json scripts）
```

- `core/mqtt-codec.test.mjs`：MQTT 3.1.1 报文编解码边界（剩余长度、CONNACK/SUBACK/PUBLISH 解析、非法输入）。
- `core/aggregation.test.mjs`：三态聚合与维度判定（扩大、受损、最坏优先、未知不吞失败）。
- `core/runner.test.mjs`：假探针注入下的运行器（健康门控→未知传播、参数传递、不支持动作）。
- `plugin/dashboard.test.mjs`：仪表盘三态统计/筛选、固定目录 latest-result 查询和 AGH client/service 清单绑定。

集成与真实 Broker 行为验证记录在 [docs/evidence](../docs/evidence/README.md)，阶段 4 已覆盖正常送达、SUBACK 0x80 拒绝、Broker 停机与恢复复测。拒绝判定必须依据明确主题级证据而非客户端退出码，见 [架构](../docs/architecture.md)。
