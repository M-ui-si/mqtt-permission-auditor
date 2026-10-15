# MQTT 权限迁移审计器本地界面一键启动（2026-10-15）

## 交付

- 根目录 `MQTT权限迁移审计器.exe`：Windows x64 单文件 GUI；配套源码 `agh_launcher.py`、构建脚本 `build-agh-launcher.ps1`。窗口与界面名称均为“MQTT 权限迁移审计器”。
- 双击 exe 后自动启动 AGH 的 `serve` 命令、显示并打开访问网址；若 AGH 已在 4180–4190 端口运行，则复用现有网页地址。
- AGH home/data 放在被忽略目录 `.local/agh-local-dev/`，不复制或读取其他 home 中的模型凭据。

## 本机运行证据

- AGH：固定源码提交 `c4efd170547a225890664c1c186a7347399b53e0`，本机检出 `vendor/agnes-harness`。
- Node.js：`.tools/node24/node.exe`，版本 `v24.21.0`。
- 当前本地网址：`http://127.0.0.1:4180/`。
- HTTP 实测：状态码 200，页面标题 `Agnes Harness`。
- 最新重命名构建经双击后自动启动；服务只监听回环地址，当前会话保持运行；AGH Web 首页可访问。新建配置目录没有复制既有模型账号，模型路由需在界面按用户账户状态配置。

## 限制

本包没有包含 AGH 上游源码或 Node.js，EXE 通过包内 `vendor/agnes-harness`、`AGH_SOURCE` 或当前机器的 `D:\AGH` 检出查找运行文件。目标机器需提供 AGH 固定版本构建产物及 Node.js 24.10+。EXE 自身构建使用 Python 3.14.6 与 PyInstaller 6.19.0。
