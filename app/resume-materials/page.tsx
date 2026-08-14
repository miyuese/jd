import type { Metadata } from "next";
import { requireClerkUserId } from "@/lib/auth-scope";
import { ResumeMaterialsWorkspace } from "@/components/resume-materials-workspace";
import { getLatestResumeMaterial, listResumeMaterials } from "@/lib/stage6-data";

export const metadata: Metadata = {
  title: "简历材料"
};

export default async function ResumeMaterialsPage() {
  const userId = requireClerkUserId();
  const [material, materials] = await Promise.all([getLatestResumeMaterial(userId), listResumeMaterials(userId)]);

  return (
    <ResumeMaterialsWorkspace
      initialContent={material?.rawText ?? ""}
      savedAt={material?.updatedAt.toISOString() ?? null}
      materials={materials.map((item) => ({
        id: item.id,
        title: item.title,
        preview: item.rawText.slice(0, 120),
        fullText: item.rawText,
        updatedAt: item.updatedAt.toISOString()
      }))}
    />
  );
}
