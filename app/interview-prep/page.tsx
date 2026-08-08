import type { Metadata } from "next";
import { InterviewPrepWorkspace } from "@/components/interview-prep-workspace";
import { requireClerkUserId } from "@/lib/auth-scope";
import { listWorkspaceProjects } from "@/lib/neon-db";
import { getLatestProjectCard } from "@/lib/stage7-data";
import { getLatestMatchAnalysis } from "@/lib/stage8-data";
import { listInterviewOutputVersions } from "@/lib/stage10-data";
import { listAbilityGaps } from "@/lib/memory-data";

export const metadata: Metadata = {
  title: "面试准备"
};

async function getLatestInterviewOutputs(projectId: string, userId: string) {
  const versions = await listInterviewOutputVersions(projectId, userId);

  const oneMinuteIntro = versions.find((v) => {
    const content = v.content as { type?: string };
    return content?.type === "ONE_MINUTE_INTRO";
  });

  const threeMinuteStory = versions.find((v) => {
    const content = v.content as { type?: string };
    return content?.type === "THREE_MINUTE_STORY";
  });

  const questionsVersion = versions.find((v) => {
    const content = v.content as { type?: string };
    return content?.type === "INTERVIEW_QUESTIONS";
  });

  return {
    oneMinuteIntro: oneMinuteIntro ? (oneMinuteIntro.content as { script?: string }).script ?? null : null,
    threeMinuteStory: threeMinuteStory ? (threeMinuteStory.content as { script?: string }).script ?? null : null,
    questions: questionsVersion ? (questionsVersion.content as { questions?: string[] }).questions ?? null : null
  };
}

export default async function InterviewPrepPage({
  searchParams
}: {
  searchParams?: { projectId?: string | string[] };
}) {
  const userId = requireClerkUserId();
  const [projects, abilityGaps] = await Promise.all([listWorkspaceProjects(userId), listAbilityGaps(userId)]);
  const serializedGaps = abilityGaps.map((gap) => ({
    ...gap,
    updatedAt: gap.updatedAt instanceof Date ? gap.updatedAt.toISOString() : String(gap.updatedAt)
  }));
  const requestedProjectId = Array.isArray(searchParams?.projectId) ? searchParams?.projectId[0] : searchParams?.projectId;
  const selectedProjectId = projects.some((project) => project.id === requestedProjectId)
    ? requestedProjectId ?? null
    : projects[0]?.id ?? null;

  if (!selectedProjectId) {
    return (
      <InterviewPrepWorkspace
        projects={[]}
        selectedProjectId={null}
        projectCardExists={false}
        matchAnalysisExists={false}
        latestOutput={{
          oneMinuteIntro: null,
          threeMinuteStory: null,
          questions: null
        }}
        initialAbilityGaps={serializedGaps}
      />
    );
  }

  const [projectCard, matchAnalysis, latestOutput] = await Promise.all([
    getLatestProjectCard(selectedProjectId, userId),
    getLatestMatchAnalysis(selectedProjectId, userId),
    getLatestInterviewOutputs(selectedProjectId, userId)
  ]);

  return (
    <InterviewPrepWorkspace
      projects={projects.map((project) => ({
        id: project.id,
        name: project.name,
        targetRole: project.targetRole,
        currentNeed: project.currentNeed
      }))}
      selectedProjectId={selectedProjectId}
      projectCardExists={Boolean(projectCard)}
      matchAnalysisExists={Boolean(matchAnalysis)}
      latestOutput={latestOutput}
      initialAbilityGaps={serializedGaps}
    />
  );
}
