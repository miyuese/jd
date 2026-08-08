import "server-only";

import { auth } from "@clerk/nextjs/server";
import { hasClerkCredentials } from "@/lib/clerk-env";

export function requireClerkUserId() {
  // 开发模式：未配置 Clerk 凭据时，使用固定开发用户，便于本地跑通全部功能
  if (!hasClerkCredentials) {
    return "dev-user";
  }

  const { userId } = auth();

  if (!userId) {
    throw new Error("当前未登录，无法访问该业务数据。请先登录后再试。");
  }

  return userId;
}
