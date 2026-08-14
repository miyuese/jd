import type { Metadata } from "next";
import { requireClerkUserId } from "@/lib/auth-scope";
import { ProjectMaterialsWorkspace } from "@/components/project-materials-workspace";
import { listProjectMaterials } from "@/lib/stage6-data";

export const metadata: Metadata = {
  title: "项目经历"
};

export default async function ProjectMaterialsPage() {
  const userId = requireClerkUserId();
  const materials = await listProjectMaterials(userId);

  return (
    <ProjectMaterialsWorkspace
      materials={materials.map((material) => ({
        id: material.id,
        projectName: material.projectName ?? material.title ?? "未命名项目",
        rawText: material.rawText,
        updatedAt: material.updatedAt.toISOString()
      }))}
    />
  );
}
