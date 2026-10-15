# fixtures

合成测试夹具。当前案例集：[cases/migration-baseline.json](cases/migration-baseline.json)（迁移基线，8 项检查）。

- 每项检查包含身份、动作、主题与**独立业务要求给出的期望值**（allow/deny），期望不来自任一端 Broker 配置。
- 身份与主题全部合成（`device-sensor`、`ops-admin`、`guest-ro`、`no-rules-user` 与 `telemetry/#`、`factory/#` 等前缀）；口令不写入夹具，运行时经 `--creds` 本地文件注入。
- 目标端 ACL 档案（naive 朴素迁移 / omission 迁移遗漏）属环境层，存 `.local/env/emqx/etc/`，用 `.local/env/stage2/use-acl.sh` 切换。

首个复现案例的实测背景见 [阶段 1 证据](../docs/evidence/stage1-acl-difference-20261007.md)。
