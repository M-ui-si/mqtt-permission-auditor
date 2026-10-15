# cli

独立命令行入口（已实现首版：`run-audit.mjs`，调用 [核心验证器](../core/README.md)）。

`environment.mjs` 管理本脚本生成的隔离环境：`init / up / check / audit / down`，可加 `--name demo`。不覆盖现有目录，不接管旧环境，停止时保留数据卷。安装前提、模板和完整流程见 [部署指南](../docs/deployment.md)。

用法：

```sh
node cli/run-audit.mjs --source 127.0.0.1:11883 --target 127.0.0.1:2883 \
  --creds .local/env/creds.json --cases fixtures/cases/migration-baseline.json [--json out.json]
```

- `--creds` 指向身份→合成口令映射（只存被忽略的本地目录，不入仓库）。
- `--source` / `--target` 仅接受数字回环地址 `127.0.0.1`（localhost、域名、非回环 IP、0.0.0.0 均拒绝；core 层另有独立校验）。
- 输出人读报告（维度汇总、逐项表、范围声明），`--json` 另存机器可读结果。
- 退出码：`0` 全部通过；`1` 存在失败；`2` 仅存在无法判定；`3` 参数或运行错误。

集成验证记录见 [阶段 2 证据](../docs/evidence/stage2-core-cli-20261007.md)。
