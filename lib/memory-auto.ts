import "server-only";

import {
  createAbilityTag,
  findMemorySourceByRef,
  ingestText,
  linkTagToChunks,
  listAbilityTags,
  type MemorySourceType
} from "@/lib/memory-data";

/**
 * 材料保存后自动沉淀进记忆库 + 自动提取能力标签（数据飞轮自动转）。
 * 幂等：同一业务记录（sourceRefId）只入库一次，不重复。
 * 全程失败静默，不阻塞主业务流程。
 */
export async function autoIngestAndExtract(clerkUserId: string, input: {
  sourceType: MemorySourceType;
  title?: string;
  rawText: string;
  sourceRefId?: string;
  projectId?: string | null;
}) {
  try {
    const exists = await findMemorySourceByRef(clerkUserId, input.sourceRefId ?? "");

    if (exists) {
      return;
    }

    const { chunks } = await ingestText({
      clerkUserId,
      sourceType: input.sourceType,
      title: input.title,
      rawText: input.rawText,
      sourceRefId: input.sourceRefId,
      projectId: input.projectId
    });

    if (chunks.length === 0) {
      return;
    }

    // 自动提取能力标签（失败静默，不影响材料保存）
    try {
      const { extractAbilityTags } = await import("@/lib/memory-ai");
      const abilities = await extractAbilityTags({
        chunks: chunks.map((chunk) => ({ id: chunk.id, content: chunk.content }))
      });

      const existing = await listAbilityTags(clerkUserId);
      const existingNames = new Set(existing.map((tag) => tag.name));

      for (const ability of abilities) {
        if (existingNames.has(ability.name)) {
          continue;
        }

        const tag = await createAbilityTag({
          clerkUserId,
          name: ability.name,
          category: ability.category,
          description: ability.description,
          confidence: ability.confidence
        });

        await linkTagToChunks(tag.id, ability.evidenceChunkIds);
        existingNames.add(ability.name);
      }
    } catch (error) {
      console.warn("[memory auto] 自动提取能力标签失败（静默）:", error);
    }
  } catch (error) {
    console.warn("[memory auto] 自动入库失败（静默）:", error);
  }
}
