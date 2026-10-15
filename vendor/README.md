# Agnes Harness 外部依赖

本项目不包含或重新分发 Agnes Harness（AGH）上游源码、Node.js 运行时、模型或模型凭据。核心验证器、Docker 本地 Broker 环境和独立 CLI 不依赖 AGH；只有 AGH 插件/Skill/面板，以及 Windows 一键启动器需要单独提供 AGH。

当前启动器与插件验证所用的上游源码版本为固定提交：

```text
c4efd170547a225890664c1c186a7347399b53e0
```

如果需要获取该版本，可从项目根目录执行：

```powershell
git clone https://github.com/AgnesAI-Labs/agnes-harness.git vendor/agnes-harness
git -C vendor/agnes-harness checkout c4efd170547a225890664c1c186a7347399b53e0
```

这只会检出源码，不会安装依赖、生成 CLI 构建产物、配置模型账户或安装本项目插件。Windows 启动器另需 Node.js 24.10+ 和上游 CLI 文件 `packages/cli/dist/local/agnes.mjs`；AGH 的依赖安装与构建请遵循[上游文档](https://github.com/AgnesAI-Labs/agnes-harness/tree/c4efd170547a225890664c1c186a7347399b53e0/docs)。

取得固定版本后，插件安装步骤见[本地部署与验收](../docs/deployment.md)，程序功能及运行边界见[运行说明](../运行说明.md)。新项目实现位于 `core/`、`cli/` 和 `plugins/agh/`；没有修改 AGH 上游源码。
