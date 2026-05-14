"use server";

import { revalidatePath } from "next/cache";
import { requireClerkUserId } from "@/lib/auth-scope";
import { insertWorkspaceProject } from "@/lib/neon-db";
import { projectFormSchema, type ProjectFormValues } from "@/lib/project-form";

type CreateProjectResult =
  | {
      success: true;
      message: string;
      project: {
        id: string;
        projectName: string;
        targetRole: string;
        currentNeed: string;
        createdAt: string;
      };
    }
  | {
      success: false;
      message: string;
    };

export async function createProjectAction(values: ProjectFormValues): Promise<CreateProjectResult> {
  const parsed = projectFormSchema.safeParse(values);

  if (!parsed.success) {
    return {
      success: false,
      message: parsed.error.issues[0]?.message ?? "表单校验失败，请检查输入内容。"
    };
  }

  const userId = requireClerkUserId();
  const project = await insertWorkspaceProject(userId, parsed.data);

  revalidatePath("/workspace");

  return {
    success: true,
    message: "项目已保存到 Neon 数据库，并同步出现在下方项目列表。",
    project
  };
}
