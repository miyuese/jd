"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireClerkUserId } from "@/lib/auth-scope";
import { saveResumeMaterial } from "@/lib/stage6-data";
import { ingestText } from "@/lib/memory-data";

const resumeMaterialSchema = z.object({
  content: z.string().trim().min(1, "请先粘贴已有简历内容，再点击保存。")
});

type SaveResumeMaterialResult =
  | {
      success: true;
      message: string;
      savedAt: string;
    }
  | {
      success: false;
      message: string;
    };

export async function saveResumeMaterialAction(content: string): Promise<SaveResumeMaterialResult> {
  const parsed = resumeMaterialSchema.safeParse({ content });

  if (!parsed.success) {
    return {
      success: false,
      message: parsed.error.issues[0]?.message ?? "简历内容校验失败，请检查后再试。"
    };
  }

  const userId = requireClerkUserId();
  const record = await saveResumeMaterial(userId, parsed.data.content);

  // 自动同步到个人记忆系统（失败不阻塞主流程）
  try {
    await ingestText({
      clerkUserId: userId,
      sourceType: "RESUME",
      title: "已有简历",
      rawText: parsed.data.content
    });
  } catch {
    // 记忆系统异常不影响简历保存
  }

  revalidatePath("/resume-materials");
  revalidatePath("/memory");

  return {
    success: true,
    message: "已有简历内容已保存到数据库，刷新后仍会保留当前版本。",
    savedAt: record.updatedAt.toISOString()
  };
}
