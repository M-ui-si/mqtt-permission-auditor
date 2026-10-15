# 可复现的本地环境

这里保存不含凭据的 Broker 模板。`cli/environment.mjs` 将模板写入被忽略的 `.local/<名称>/`，生成新的合成口令并固定镜像摘要。不会覆盖已有环境。

默认案例 `naive` 用于演示禁止主题实际送达；`corrected` 把具体拒绝放到允许之前；`omission` 模拟业务授权遗漏。修复后仍可能无法判定，不能把未送达解释为拒绝。

运行方式及 AGH 安装见 [部署指南](../docs/deployment.md)。
