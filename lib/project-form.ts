import { z } from "zod";

export const projectFormSchema = z.object({
  projectName: z.string().trim().min(1, "请输入项目名称"),
  targetRole: z.string().trim().min(1, "请输入目标岗位"),
  currentNeed: z.string().trim().min(1, "请填写当前需求")
});

export type ProjectFormValues = z.infer<typeof projectFormSchema>;

export const defaultProjectFormValues: ProjectFormValues = {
  projectName: "",
  targetRole: "",
  currentNeed: ""
};
