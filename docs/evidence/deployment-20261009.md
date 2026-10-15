# 可复现部署环境实测（2026-10-09）

## 范围

在 Docker Desktop 29.8.0 / Engine 29.8.0、Compose v5.5.1 上验证工作区生成的 `.local/reproducible` 环境。仅使用固定摘要的 Mosquitto/EMQX 镜像、独立合成账号、ACL 夹具和本机回环端口。没有连接外部目标、启动 Agnes 模型会话或读取模型凭据。

镜像摘要：

- Mosquitto：`eclipse-mosquitto@sha256:38c0da4f2ef84284d47b3b3eeea1cb3bdeabe81ee10caf0cd5c5ff61ee3ea408`
- EMQX：`emqx@sha256:5ecbf93d04e34aaf4096af074e93b773d0838c8ea668cfabdec7976b272d9606`

## 部署检查

| 检查 | 观测 |
| --- | --- |
| Compose 模板解析 | `docker compose config --quiet` 成功 |
| Mosquitto / EMQX 容器 | 均运行；镜像健康检查正常 |
| 宿主端口 | `127.0.0.1:11883`、`127.0.0.1:2883` 均可连接，Compose 显示到容器端口 1883 的映射 |
| Broker 送达健康检查 | 两侧见证者均实际收到随机标记，`witness-received-message` |
| Mosquitto 合成密码文件 | 哈希阶段属主 `root:root`、模式 `0600`；启动阶段切换为 `1883:1883`、`0600`。新建临时环境单独验证了哈希转换无权限警告，最终 Broker 见证往返通过 |
| 数据卷 | `mqtt-audit-reproducible_emqx-data`、`mqtt-audit-reproducible_emqx-log`、`mqtt-audit-reproducible_mosquitto-data` 保留 |

实测发现旧模板把两张网络设成 `internal: true`。Docker Compose 文档说明 internal 网络不接入宿主机网卡；本机观测与之相符：容器运行，但 `NetworkSettings.Ports` 为空，工具连接两个回环端口均遭拒绝。修复后源/目标仍在相互分离的 bridge 网络中，关闭 bridge 的 outbound IP masquerading，并将服务端口显式绑定到 `127.0.0.1`。该设置不等于容器无法路由到宿主机或任意地址；测试程序只访问固定回环 Broker，不宣称更强隔离。此项属于部署实现更正，引用文档：[Docker Compose 网络说明](https://docs.docker.com/compose/how-tos/networking/)。

## 固定案例结果

运行 `node cli/environment.mjs audit --name reproducible`，报告 `run-1791535863470-01195937`：

- `overall=fail`；`requirementFailures` 仅有 `c3 target`。device-sensor 发布 `factory/admin/secret` 后目标端见证者实际收到消息，违反独立业务要求。
- 权限扩大与业务受损计数均为 0。c3 源端未送达没有明确主题级拒绝证据，按新语义为 unknown，因此没有虚报权限扩大。
- c2 两端、c3 源端、c7 源端、c8 两端共 6 项为 unknown；其余允许路径按实际送达及业务要求判定。

该默认 naive 案例预期以失败结束，展示的是目标端业务要求失败，不代表部署失败。完整运行 JSON 留在被忽略的 `.local/reproducible/agh-runs/`，本证据只记录脱敏摘要。
