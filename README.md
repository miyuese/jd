# AI 面试复盘与 JD 定制求职助手

> 一款帮助求职者基于真实经历完成**项目复盘、岗位匹配表达和面试准备**的 AI 辅助工作流产品。
> 它不是"一键生成简历"工具，而是帮用户把真实经历**讲得清楚、讲得可信、讲得贴合岗位**。

## 核心价值

| 问题 | 本产品的解法 |
| --- | --- |
| 有经历但不会复盘，讲不清背景/职责/决策/结果 | AI 采访式提问，逐步沉淀结构化项目卡片 |
| 知道做了什么，但不会提炼岗位价值 | JD 能力解析 → 项目能力映射 → 匹配点/差距点分析 |
| 简历写出来像流水账、经不起深问 | 基于已确认事实的 JD 定制改写，事实/推断/建议分层标注 |
| 面试容易讲散、讲虚 | 1 分钟 / 3 分钟讲稿 + 高频追问清单 |
| 每次求职都从零开始 | 个人记忆系统：证据不可变、能力标签可溯源、面试反馈回流补强 |

## 功能闭环

```
登录 → 新建项目 → 录入/上传材料（docx/pdf/文本）
  → AI 采访式复盘 → 项目卡片草稿 → 用户确认事实
  → 解析 JD → 岗位能力摘要 → 匹配分析（匹配点/差距点/建议）
  → 简历改写（多策略）→ 面试表达（1分钟/3分钟/追问清单）
  → 版本历史管理 → 记忆库沉淀 → 能力画像
```

## 特色能力

- **可信输出控制**：输出区分「已确认事实 / 合理推断 / 表达建议」三层，AI 不得编造职责与数据，全部关键结果支持用户确认与编辑。
- **个人记忆系统（V1.1）**：简历、项目材料、采访问答、面试反馈统一沉淀为不可变证据（L1），AI 抽取三层能力标签并链接证据（L2），写简历/准备面试时只召回与目标 JD 匹配的标签与证据（L3），句句可溯源。
- **数据飞轮**：面试反馈 → 能力缺口标签 → 下次简历改写自动提醒补强。
- **AI 模型配置页（V1.2）**：在网站内直接切换模型（baseURL / API Key / 主模型 / 备用模型），保存即生效，无需重新部署；主模型失败自动降级到备用模型，演示不翻车。
- **版本管理**：项目卡片、匹配分析、简历改写、面试表达全部版本化，可回看、可恢复。

## 技术栈

| 层 | 技术 |
| --- | --- |
| 前端 | Next.js 14 (App Router) + TypeScript + Tailwind CSS |
| 后端 | Next.js Route Handlers + Server Actions |
| 鉴权 | Clerk |
| 数据库 | Neon Postgres + Prisma 6（部分能力用原生 SQL） |
| AI | Vercel AI SDK + OpenAI-compatible 接口（支持多模型 fallback） |
| 文档解析 | pdfjs-dist / mammoth / tesseract.js |
| 校验 | zod |

## 项目结构

```
app/
  workspace/            工作台
  memory/               记忆库与能力画像
  resume-materials/     简历材料
  project-materials/    项目材料
  project-card/         项目卡片与事实确认
  jd-analysis/          JD 解析与匹配分析
  resume-rewrite/       简历改写
  interview-prep/       面试表达生成
  history/              历史版本时间线
  settings/             AI 模型配置 + 数据导出
components/             页面工作区组件
lib/
  ai-config.ts          AI 调用统一入口（DB 配置优先 + 多模型降级）
  ai-config-data.ts     AI 配置数据访问
  memory-ai.ts          记忆系统 AI 能力
  memory-data.ts        记忆系统数据访问
  export-data.ts        全量数据导出
prisma/schema.prisma    数据模型
scripts/                SQL 迁移脚本
```

## 本地开发

### 环境变量（.env.local）

```env
# Clerk 鉴权
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_xxx
CLERK_SECRET_KEY=sk_test_xxx
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up
NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL=/workspace
NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL=/workspace

# 数据库（Neon）
DATABASE_URL="postgres://xxx@ep-xxx.aws.neon.tech/db?sslmode=require"
DIRECT_URL="postgres://xxx@ep-xxx.aws.neon.tech/db?sslmode=require"

# AI 模型（环境变量作为兜底；也可在网站内 /settings 页配置，优先级更高）
AI_API_BASE_URL=https://api.deepseek.com
AI_API_KEY=sk-xxx
AI_MODEL=deepseek-chat
AI_FALLBACK_MODELS=deepseek-reasoner   # 可选，逗号分隔的备用模型
AI_PROVIDER_NAME=openai-compatible
```

### 运行

```bash
npm install
# 应用数据库迁移（分别对应各阶段表）
npm run db:apply-stage4
npm run db:apply-memory
npm run db:apply-ai-config
npm run dev
```

## 部署（Vercel）

1. 推送代码到 GitHub，在 Vercel 导入仓库；
2. 配置上述环境变量（生产环境使用 Clerk / Neon / AI 的生产凭据）；
3. 部署后执行数据库迁移脚本（或在 Neon 控制台执行 `prisma/migrations` 下的 SQL）；
4. 打开线上 `/settings` 配置 AI 模型，点「测试连接」验证，保存即生效。

## 相关文档

- [产品需求文档（PRD）](./AI面试复盘与JD定制求职助手-PRD.md)
- [全栈落地闯关大纲](./AI面试复盘与JD定制求职助手-项目全栈落地闯关大纲.md)

## 设计原则

- 先澄清事实，再生成表达；不替用户编故事。
- 明确区分事实、推断、建议三类信息。
- 所有生成结果可编辑、可确认、可追溯。
- 输出追求「讲真、讲清、讲准」，而不是「讲得夸张、讲得高级」。
