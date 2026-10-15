# 文档导航

当前状态：阶段 4 已于 2026-10-08 用真实本地 Broker 按修正后的判定语义完成复验，并归档正常、边界、失败三类样例；阶段 0–3 历史证据仍基于当时的语义。可复现部署脚本与基于当前 AGH 工具轨迹的会话查询已实现。当前工作区就是最终成品，不安排平移到第二套 AGH。2026-10-14 真实 Agnes 会话闭环与右栏面板画面验收已完成；三个独立会话的三类样例演示视频已实录并生成中文字幕和合成配音，见[视频实录证据](evidence/demo-video-20261014.md)。视频尚未发布，提交包仍待最终提交；提交材料见[比赛提交材料](competition-submission.md)。

目录按"项目说明 → 比赛材料 → 计划与过程 → 证据"分组；2026-10-14 起四份计划类文档统一移入 [plans/](plans/) 子目录（交接见 [进度](progress.md) 当日条目）。

## 项目说明

- [AGH 一键启动](../运行说明.md#windows-一键启动器)
- [架构与范围](architecture.md)
- [部署与验收指南](deployment.md)（公开模板、启动与健康检查、AGH 本地安装）
- [环境版本记录](environment-versions.md)（镜像摘要与实测行为）
- [查重调研与差异](research.md)

## 比赛材料

- [演示视频台本：通俗版文字改稿](提交材料/演示视频台本-通俗版.md)——用户已确认，已制作云希男声新版视频；[v2 制作与验证](evidence/demo-video-v2-20261015.md)
- [比赛提交材料](competition-submission.md)——**独立成文的提交材料文件**：表单文字、演示视频分镜与提示词、证据附件与脱敏清单
- 表单拆分（中文命名）：[基本信息](提交材料/基本信息.md)、[技术信息](提交材料/技术信息.md)、[成员声明](提交材料/成员声明.md)
- [比赛要求备忘](competition.md)——主办方要求整理与当前提交状态

## 计划与过程

- [进度与交接](progress.md)（各批次实际执行记录，置顶为最新交接）
- [研发计划](plans/development-plan.md)（阶段 0–4 已完成，阶段 5 为当前成品验收与比赛材料，不含平移）
- [环境准备方案](plans/environment-setup-plan.md)（阶段 0，已执行）
- [AGH 审计结果面板建设计划](plans/dashboard.md)（过程面板与可选 Jev）
- [递归 RS、决策与经验改进计划](plans/improvement-plan.md)（现状、缺口、可视化方案与待验收标准）

## 证据

- [新项目证据规范](evidence/README.md)
  - [阶段 1：ACL 差异复现](evidence/stage1-acl-difference-20261007.md)
  - [阶段 2：核心与 CLI](evidence/stage2-core-cli-20261007.md)
  - [阶段 3：AGH 插件](evidence/stage3-agh-plugin-20261007.md)
  - [阶段 4：新语义本地 Broker 复验](evidence/stage4-integration-20261008.md)
  - [部署运行记录 2026-10-09](evidence/deployment-20261009.md)
  - [过程面板与真实会话 2026-10-14](evidence/dashboard-process-20261014.md)
  - [三类样例演示视频实录 2026-10-14](evidence/demo-video-20261014.md)
  - [MQTT 权限迁移审计器本地界面一键启动 2026-10-15](evidence/agh-launcher-20261015.md)

本目录已重新建立。旧项目文档和证据仅通过 Git 历史追溯，不计入本项目成果。
