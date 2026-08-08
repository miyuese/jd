import type { Metadata } from "next";
import { requireClerkUserId } from "@/lib/auth-scope";
import { listMemorySources, listAbilityTags } from "@/lib/memory-data";
import { MemoryWorkspace } from "@/components/memory-workspace";

export const metadata: Metadata = {
  title: "记忆库与能力画像"
};

export default async function MemoryPage() {
  const userId = requireClerkUserId();
  const [sources, abilities] = await Promise.all([
    listMemorySources(userId),
    listAbilityTags(userId)
  ]);

  return (
    <MemoryWorkspace
      initialSources={sources.map((source) => ({
        id: source.id,
        sourceType: source.sourceType,
        title: source.title ?? "",
        rawText: source.rawText,
        createdAt: source.createdAt instanceof Date ? source.createdAt.toISOString() : String(source.createdAt)
      }))}
      initialAbilities={abilities.map((tag) => ({
        id: tag.id,
        name: tag.name,
        category: tag.category,
        description: tag.description ?? "",
        confidence: tag.confidence,
        status: tag.status,
        createdAt: tag.createdAt instanceof Date ? tag.createdAt.toISOString() : String(tag.createdAt)
      }))}
    />
  );
}
