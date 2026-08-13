"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireClerkUserId } from "@/lib/auth-scope";
import {
  createAbilityTag,
  deleteAbilityTag,
  deleteAbilityTags,
  deleteMemorySource,
  getMemorySourceById,
  ingestText,
  linkTagToChunks,
  listAbilityTags,
  listChunksBySource,
  listChunksByTag,
  updateAbilityTagStatus,
  type AbilityCategory,
  type MemorySourceType,
  type TagStatus
} from "@/lib/memory-data";
import { extractGapTagsFromFeedback } from "@/lib/memory-ai";

type ActionResult =
  | {
      success: true;
      message: string;
      data?: unknown;
      savedAt?: string;
    }
  | {
      success: false;
      message: string;
    };

// ========== 材料入库 ==========

const ingestSchema = z.object({
  sourceType: z.enum(["RESUME", "PROJECT_MATERIAL", "INTERVIEW_ANSWER", "INTERVIEW_FEEDBACK", "REFLECTION", "MANUAL"]),
  title: z.string().trim().max(100).optional(),
  content: z.string().trim().min(1, "请输入要存入记忆库的内容。"),
  sourceRefId: z.string().optional(),
  projectId: z.string().optional()
});

export async function ingestMemoryAction(input: {
  sourceType: MemorySourceType;
  title?: string;
  content: string;
  sourceRefId?: string;
  projectId?: string;
}): Promise<ActionResult> {
  const parsed = ingestSchema.safeParse(input);

  if (!parsed.success) {
    return {
      success: false,
      message: parsed.error.issues[0]?.message ?? "材料入库失败，请检查输入后再试。"
    };
  }

  const userId = requireClerkUserId();

  try {
    const result = await ingestText({
      clerkUserId: userId,
      sourceType: parsed.data.sourceType,
      title: parsed.data.title,
      rawText: parsed.data.content,
      sourceRefId: parsed.data.sourceRefId,
      projectId: parsed.data.projectId
    });

    revalidatePath("/memory");

    return {
      success: true,
      message: `已存入记忆库，共切分为 ${result.chunks.length} 个证据片段。`,
      data: {
        sourceId: result.source.id,
        chunkCount: result.chunks.length
      },
      savedAt: result.source.createdAt instanceof Date ? result.source.createdAt.toISOString() : String(result.source.createdAt)
    };
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : "材料入库失败，请稍后再试。"
    };
  }
}

// ========== 删除记忆源 ==========

export async function deleteMemorySourceAction(sourceId: string): Promise<ActionResult> {
  const userId = requireClerkUserId();

  try {
    await deleteMemorySource(sourceId, userId);

    revalidatePath("/memory");

    return {
      success: true,
      message: "记忆源已删除，关联的证据片段和引用一并清除。"
    };
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : "删除记忆源失败，请稍后再试。"
    };
  }
}

// ========== 能力标签抽取 ==========

// AI 输出偶发不稳定（模型可能输出空或被截断），带重试兜底
async function extractAbilitiesWithRetry(chunks: Array<{ id: string; content: string }>): Promise<
  import("@/lib/memory-ai").ExtractedAbility[]
> {
  const { extractAbilityTags } = await import("@/lib/memory-ai");
  let lastError: unknown = null;

  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      return await extractAbilityTags({ chunks });
    } catch (error) {
      lastError = error;
      // 最后一次失败才抛出
      if (attempt === 3) {
        break;
      }
    }
  }

  throw lastError instanceof Error ? lastError : new Error("AI 标签提取失败，请稍后再试。");
}

export async function extractAbilitiesAction(sourceId: string): Promise<ActionResult> {
  const userId = requireClerkUserId();

  try {
    const source = await getMemorySourceById(sourceId, userId);

    if (!source) {
      return {
        success: false,
        message: "记忆源不存在，或你无权访问。"
      };
    }

    const chunks = await listChunksBySource(sourceId);

    if (chunks.length === 0) {
      return {
        success: false,
        message: "该记忆源还没有可分析的证据片段，请先确认内容已入库。"
      };
    }

    const abilities = await extractAbilitiesWithRetry(
      chunks.map((chunk) => ({ id: chunk.id, content: chunk.content }))
    );

    if (abilities.length === 0) {
      return {
        success: false,
        message: "AI 未能从该材料中提取出可信的能力标签，可补充更多材料后再试。"
      };
    }

    const existing = await listAbilityTags(userId);
    const existingNames = new Set(existing.map((tag) => tag.name));

    let createdCount = 0;
    for (const ability of abilities) {
      // 同名标签去重：已存在则跳过，避免画像重复
      if (existingNames.has(ability.name)) {
        continue;
      }

      const tag = await createAbilityTag({
        clerkUserId: userId,
        name: ability.name,
        category: ability.category,
        description: ability.description,
        confidence: ability.confidence
      });

      await linkTagToChunks(tag.id, ability.evidenceChunkIds);
      existingNames.add(ability.name);
      createdCount += 1;
    }

    revalidatePath("/memory");

    if (createdCount === 0) {
      return {
        success: true,
        message: "该材料中的能力标签与已有画像重复，未新增标签。"
      };
    }

    return {
      success: true,
      message: `已从该材料中提取 ${createdCount} 个能力标签，每条标签都链接了证据片段，可在能力画像中确认或驳回。`,
      data: { createdCount }
    };
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : "能力标签提取失败，请稍后再试。"
    };
  }
}

// ========== 标签确认 / 驳回 ==========

const updateTagStatusSchema = z.object({
  tagId: z.string().min(1),
  status: z.enum(["DRAFT", "CONFIRMED", "REJECTED"])
});

export async function updateAbilityStatusAction(tagId: string, status: TagStatus): Promise<ActionResult> {
  const parsed = updateTagStatusSchema.safeParse({ tagId, status });

  if (!parsed.success) {
    return {
      success: false,
      message: "标签状态更新失败，请检查输入后再试。"
    };
  }

  const userId = requireClerkUserId();

  try {
    const tag = await updateAbilityTagStatus(parsed.data.tagId, userId, parsed.data.status);

    if (!tag) {
      return {
        success: false,
        message: "标签不存在，或你无权修改。"
      };
    }

    revalidatePath("/memory");

    const statusLabels: Record<TagStatus, string> = {
      DRAFT: "待确认",
      CONFIRMED: "已确认",
      REJECTED: "已驳回"
    };

    return {
      success: true,
      message: `标签「${tag.name}」已标记为${statusLabels[tag.status]}。`
    };
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : "标签状态更新失败，请稍后再试。"
    };
  }
}

// ========== 标签删除（单个 / 批量） ==========

export async function deleteAbilityTagAction(tagId: string): Promise<ActionResult> {
  if (!tagId.trim()) {
    return {
      success: false,
      message: "标签不存在，或你无权删除。"
    };
  }

  const userId = requireClerkUserId();

  try {
    await deleteAbilityTag(tagId, userId);

    revalidatePath("/memory");

    return {
      success: true,
      message: "能力标签已删除。"
    };
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : "删除能力标签失败，请稍后再试。"
    };
  }
}

const deleteTagsSchema = z.object({
  tagIds: z.array(z.string().min(1)).min(1, "请至少选择一个能力标签。")
});

export async function deleteAbilityTagsAction(tagIds: string[]): Promise<ActionResult> {
  const parsed = deleteTagsSchema.safeParse({ tagIds });

  if (!parsed.success) {
    return {
      success: false,
      message: parsed.error.issues[0]?.message ?? "批量删除失败，请检查输入后再试。"
    };
  }

  const userId = requireClerkUserId();

  try {
    const deletedCount = await deleteAbilityTags(parsed.data.tagIds, userId);

    if (deletedCount === 0) {
      return {
        success: false,
        message: "没有可删除的标签，或标签已不存在。"
      };
    }

    revalidatePath("/memory");

    return {
      success: true,
      message: `已删除 ${deletedCount} 个能力标签。`
    };
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : "批量删除能力标签失败，请稍后再试。"
    };
  }
}

// ========== 面试反馈回流 ==========

const feedbackSchema = z.object({
  feedbackText: z.string().trim().min(1, "请输入面试反馈内容。"),
  projectId: z.string().optional()
});

export async function recordInterviewFeedbackAction(input: {
  feedbackText: string;
  projectId?: string;
}): Promise<ActionResult> {
  const parsed = feedbackSchema.safeParse(input);

  if (!parsed.success) {
    return {
      success: false,
      message: parsed.error.issues[0]?.message ?? "面试反馈记录失败，请检查输入后再试。"
    };
  }

  const userId = requireClerkUserId();

  try {
    // 1. 反馈文本入库（INTERVIEW_FEEDBACK 类型）
    const ingestResult = await ingestText({
      clerkUserId: userId,
      sourceType: "INTERVIEW_FEEDBACK",
      title: "面试反馈",
      rawText: parsed.data.feedbackText,
      projectId: parsed.data.projectId
    });

    // 2. AI 提取能力缺口
    const existingTags = await listAbilityTags(userId, "GENERAL");
    const existingRoleTags = await listAbilityTags(userId, "ROLE_SPECIFIC");
    const existingNames = [...existingTags, ...existingRoleTags].map((tag) => tag.name);

    let gapCount = 0;

    try {
      const gaps = await extractGapTagsFromFeedback({
        feedbackText: parsed.data.feedbackText,
        existingAbilityNames: existingNames
      });

      for (const gap of gaps) {
        // 缺口标签：低置信度、默认 DRAFT，名称带「缺口：」前缀以便区分
        const tag = await createAbilityTag({
          clerkUserId: userId,
          name: `缺口：${gap.name}`,
          category: "ROLE_SPECIFIC",
          description: gap.reason,
          confidence: 0.35,
          status: "DRAFT"
        });

        // 关联到反馈证据
        await linkTagToChunks(tag.id, ingestResult.chunks.map((chunk) => chunk.id));
        gapCount += 1;
      }
    } catch {
      // 缺口提取失败不阻塞反馈记录
    }

    revalidatePath("/memory");

    return {
      success: true,
      message: gapCount > 0
        ? `面试反馈已存入记忆库，并识别出 ${gapCount} 个能力缺口标签，将在下次简历改写时提醒补强。`
        : "面试反馈已存入记忆库（本次未识别出新的能力缺口）。",
      data: { gapCount }
    };
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : "面试反馈记录失败，请稍后再试。"
    };
  }
}

// ========== 标签证据溯源 ==========

export async function getTagEvidenceAction(tagId: string): Promise<ActionResult> {
  const userId = requireClerkUserId();

  try {
    const chunks = await listChunksByTag(tagId);

    return {
      success: true,
      message: `该标签关联了 ${chunks.length} 条证据。`,
      data: {
        evidence: chunks.map((chunk) => ({
          chunkId: chunk.id,
          content: chunk.content,
          sourceTitle: chunk.sourceTitle,
          sourceType: chunk.sourceType
        }))
      }
    };
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : "证据溯源查询失败，请稍后再试。"
    };
  }
}

export type { AbilityCategory };
