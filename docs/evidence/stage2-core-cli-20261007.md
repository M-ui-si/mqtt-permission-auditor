# 阶段 2 记录：核心验证器与 CLI（2026-10-07）

> **语义修订标注（2026-10-07 审查后续批次）**：本页编写时的判定语义为"收到 PUBACK 但未送达 = 拒绝"。现行语义（见 [core/prober.mjs](../../core/prober.mjs) 与 [架构](../architecture.md)）已改为：发布未送达一律"无法判定"、连接层拒绝（CONNACK 4/5）判"无法判定"、主题级拒绝证据仅限 SUBACK 0x80。本页作为**历史事实**保留原文不改写；逐项表中依赖旧语义的分类（`puback-without-delivery` 记为"拒绝"的行，如 c2/c8、c3 源端、c4/c5 目标端拒绝）尚待新语义下对真实 Broker 重跑后再引用。不依赖该分类的结果（送达类允许判定、停机轮 unknown 语义、恢复轮签名一致性）不受影响。

按 [研发计划](../plans/development-plan.md) 阶段 2 交付：确定性 core、CLI、固定案例集与单元/集成验证。全部命令与结果在本机完成，Broker 为本地隔离实例（镜像摘要见 [环境版本记录](../environment-versions.md)）。

## 交付物

| 位置 | 内容 |
| --- | --- |
| `core/mqtt-client.mjs` | 零依赖 MQTT 3.1.1 客户端子集（CONNECT/CONNACK、SUBSCRIBE/SUBACK、QoS1 PUBLISH/PUBACK、下行接收与 PUBACK 应答） |
| `core/prober.mjs` | 送达见证探针：发布判定以见证者实际收件为准；订阅判定区分 SUBACK 0x80 / 无 SUBACK / 授予但未送达，并用见证者归因发布侧 |
| `core/runner.mjs` | 健康门控、双端执行、三态聚合（失败 > 无法判定 > 通过）、权限扩大/业务受损/业务要求维度汇总 |
| `core/report.mjs`、`cli/run-audit.mjs` | 人读报告 + JSON + 退出码（0 通过 / 1 失败 / 2 仅无法判定 / 3 参数错误） |
| `fixtures/cases/migration-baseline.json` | 8 项固定检查（c1–c8），期望值来自独立业务要求 |
| `tests/core/*.test.mjs` | 18 项单元测试 |

## 单元测试

`node --test tests/core/mqtt-codec.test.mjs tests/core/aggregation.test.mjs tests/core/runner.test.mjs` → **18 pass / 0 fail**。覆盖：报文编解码边界；聚合三态优先级（未知不吞失败、扩大/受损判定）；运行器健康门控（目标端不可用→该侧全部无法判定且不计扩大）、不支持动作→无法判定、探针参数传递。

## 集成运行（真实本地 Broker，四轮）

CLI 一律：

```sh
node cli/run-audit.mjs --source 127.0.0.1:1883 --target 127.0.0.1:2883 \
  --creds .local/env/creds.json --cases fixtures/cases/migration-baseline.json --json <输出>
```

| 轮次 | 目标端状态 | 关键结果 | 退出码 |
| --- | --- | --- | --- |
| R1 档案 naive（朴素迁移） | 健康 | c3 失败 + 权限扩大（源拒 `puback-without-delivery` / 目标允许 `witness-received-message`）；其余 7 项通过 | 1 |
| R2 档案 omission（迁移遗漏） | 健康 | c3 扩大仍在；c4、c5 失败 + 业务受损（目标端拒绝业务必需的发布/订阅） | 1 |
| R3 目标端停止 | `ECONNREFUSED` | 目标侧 8 项全部"无法判定(broker-unavailable)"，不计扩大/受损；源端 8 项正常评估 | 2 |
| R4 目标端恢复复测 | 健康 | 检查结论签名与 R2 完全一致（程序化比对通过）：停机前的失败集恢复重现，未知项归零 | 1 |

完整 JSON 报告存于被忽略的 `.local/env/stage2/report-*.json`；上方为结论摘录。三轮真实运行的观测理由（`witness-received-message` / `puback-without-delivery` / `suback-0x80-denied` / `granted-but-not-delivered`）与阶段 1 实测行为一一对应。

## 过程中发现并修复的缺陷

- R3 首次运行时发现：TCP 连接失败场景下 CONNACK 等待 Promise 无处理者，未处理拒绝导致进程崩溃（`ECONNREFUSED` 直接抛出而非进入"无法判定"）。修复为提前挂接空捕获；复测 R3 输出符合三态语义，18 项单测复跑通过。该缺陷本身即"连接失败不得当作拒绝/通过"语义的回归案例。

## 边界与未覆盖

- 首版检查动作仅 publish/subscribe；ACL 语法支持以两端实测形态为准，不宣称完整语义覆盖。
- core 对 Broker 的访问仅限调用方传入的本地端点与合成凭据；不含任意 Shell、文件读取或模型调用。
- 本阶段未实现 AGH 插件（阶段 3）；JSON 报告为插件结构化返回的输入格式。
