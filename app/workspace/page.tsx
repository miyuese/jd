import type { Metadata } from "next";
import { requireClerkUserId } from "@/lib/auth-scope";
import { listWorkspaceProjects } from "@/lib/neon-db";
import { WorkspacePage } from "@/components/workspace-page";

export const metadata: Metadata = {
  title: "工作台"
};

export default async function WorkspaceRoutePage() {
  const userId = requireClerkUserId();
  const projects = await listWorkspaceProjects(userId);

  return <WorkspacePage projectCount={projects.length} projects={projects} />;
}
