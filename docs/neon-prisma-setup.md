# Neon + Prisma 连接准备

## 目标

为 Quest 3.3 准备本地数据库连接参数，不在本阶段创建业务表。

## 需要准备的环境变量

在 `.env.local` 中补齐以下字段：

```env
DATABASE_URL=
DIRECT_URL=
```

## 推荐填写方式

- `DATABASE_URL`：填 Neon 提供的 pooled connection string，供应用运行时使用
- `DIRECT_URL`：填 Neon 提供的 direct connection string，供 Prisma Migrate 使用

## 命令默认读取位置

当前项目中的 Prisma 命令已配置为默认读取根目录下的 `.env.local`，这样可以和 Next.js 使用同一份环境变量文件。

## 本地可用命令

```bash
npm run prisma:validate
npm run prisma:generate
npm run prisma:studio
```

## 当前阶段说明

- 现在只做连接准备，不创建业务模型
- 业务模型会在 Quest 4.1 再统一定义
- 如果 `DIRECT_URL` 暂时没有拿到，至少先准备 `DATABASE_URL`，但正式迁移前仍建议补齐
