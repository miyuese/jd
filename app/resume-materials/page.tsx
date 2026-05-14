import type { Metadata } from "next";
import { requireClerkUserId } from "@/lib/auth-scope";
import { ResumeMaterialsWorkspace } from "@/components/resume-materials-workspace";
import { getLatestResumeMaterial } from "@/lib/stage6-data";

export const metadata: Metadata = {
  title: "简历材料"
};

export default async function ResumeMaterialsPage() {
  const userId = requireClerkUserId();
  const material = await getLatestResumeMaterial(userId);

  return <ResumeMaterialsWorkspace initialContent={material?.rawText ?? ""} savedAt={material?.updatedAt.toISOString() ?? null} />;
}
