import "server-only";

import { auth } from "@clerk/nextjs/server";

export function requireClerkUserId() {
  const { userId } = auth();

  if (!userId) {
    throw new Error("当前未登录，无法访问该业务数据。请先登录后再试。");
  }

  return userId;
}
