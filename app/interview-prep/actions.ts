"use server";

import { revalidatePath } from "next/cache";
import { requireClerkUserId } from "@/lib/auth-scope";
import { generateInterviewQuestionsList, generateOneMinuteIntro, generateThreeMinuteStory } from "@/lib/ai-config";
import { getWorkspaceProjectById } from "@/lib/neon-db";
import { getLatestProjectCard, listProjectCards } from "@/lib/stage7-data";
import { getLatestMatchAnalysis, getMatchAnalysisByJdRecord } from "@/lib/stage8-data";
import { createInterviewOutputVersion } from "@/lib/stage10-data";

type ActionResult =
  | {
      success: true;
      message: string;
      script?: string;
      questions?: string[];
      highlights?: string[];
      savedAt?: string;
      model?: string;
    }
  | {
      success: false;
      message: string;
    };

async function getInterviewInputs(projectId: string, userId: string, jdId?: string, cardId?: string) {
  const [project, projectCard, matchAnalysis] = await Promise.all([
    getWorkspaceProjectById(projectId, userId),
    cardId
      ? listProjectCards(userId).then((cards) => cards.find((card) => card.id === cardId) ?? null)
      : getLatestProjectCard(projectId, userId),
    jdId ? getMatchAnalysisByJdRecord(jdId, userId, cardId) : getLatestMatchAnalysis(projectId, userId)
  ]);

  if (!project) {
    throw new Error("当前项目不存在，或你无权为该项目生成面试内容。");
  }

  if (!projectCard) {
    throw new Error("请先完成项目卡片确认，再开始生成面试内容。");
  }

  if (!matchAnalysis) {
    throw new Error("请先完成 JD 匹配分析，再开始生成面试内容。");
  }

  return {
    project,
    projectCard,
    matchAnalysis
  };
}

export async function generateOneMinuteIntroAction(projectId: string, jdId?: string, cardId?: string): Promise<ActionResult> {
  const userId = requireClerkUserId();

  try {
    const { project, projectCard, matchAnalysis } = await getInterviewInputs(projectId, userId, jdId, cardId);
    const result = await generateOneMinuteIntro({
      projectCard: {
        title: projectCard.title ?? project.name,
        background: projectCard.background ?? "",
        responsibility: projectCard.responsibility ?? "",
        result: projectCard.result ?? ""
      },
      matchAnalysis: {
        matchedPoints: matchAnalysis.matchedPoints as string[],
        gapPoints: matchAnalysis.gapPoints as string[],
        suggestionPoints: matchAnalysis.suggestionPoints as string[],
        summary: matchAnalysis.summary ?? ""
      }
    });

    const version = await createInterviewOutputVersion(
      projectId,
      userId,
      `1 分钟介绍 · ${project.name}`,
      { type: "ONE_MINUTE_INTRO", ...result },
      projectCard.id,
      matchAnalysis.id,
      matchAnalysis.jdRecordId
    );

    revalidatePath("/interview-prep");

    return {
      success: true,
      message: "1 分钟项目介绍稿已生成并保存为输出版本。",
      script: result.script,
      highlights: result.highlights,
      savedAt: version.createdAt.toISOString(),
      model: result.model
    };
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : "生成 1 分钟介绍稿失败，请稍后再试。"
    };
  }
}

export async function generateThreeMinuteStoryAction(projectId: string, jdId?: string, cardId?: string): Promise<ActionResult> {
  const userId = requireClerkUserId();

  try {
    const { project, projectCard, matchAnalysis } = await getInterviewInputs(projectId, userId, jdId, cardId);
    const result = await generateThreeMinuteStory({
      projectCard: {
        title: projectCard.title ?? project.name,
        background: projectCard.background ?? "",
        responsibility: projectCard.responsibility ?? "",
        result: projectCard.result ?? ""
      },
      matchAnalysis: {
        matchedPoints: matchAnalysis.matchedPoints as string[],
        gapPoints: matchAnalysis.gapPoints as string[],
        suggestionPoints: matchAnalysis.suggestionPoints as string[],
        summary: matchAnalysis.summary ?? ""
      }
    });

    const version = await createInterviewOutputVersion(
      projectId,
      userId,
      `3 分钟展开稿 · ${project.name}`,
      { type: "THREE_MINUTE_STORY", ...result },
      projectCard.id,
      matchAnalysis.id,
      matchAnalysis.jdRecordId
    );

    revalidatePath("/interview-prep");

    return {
      success: true,
      message: "3 分钟项目展开稿已生成并保存为输出版本。",
      script: result.script,
      highlights: result.highlights,
      savedAt: version.createdAt.toISOString(),
      model: result.model
    };
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : "生成 3 分钟展开稿失败，请稍后再试。"
    };
  }
}

export async function generateInterviewQuestionsAction(projectId: string, jdId?: string, cardId?: string): Promise<ActionResult> {
  const userId = requireClerkUserId();

  try {
    const { project, projectCard, matchAnalysis } = await getInterviewInputs(projectId, userId, jdId, cardId);
    const result = await generateInterviewQuestionsList({
      projectCard: {
        title: projectCard.title ?? project.name,
        background: projectCard.background ?? "",
        responsibility: projectCard.responsibility ?? "",
        result: projectCard.result ?? ""
      },
      matchAnalysis: {
        matchedPoints: matchAnalysis.matchedPoints as string[],
        gapPoints: matchAnalysis.gapPoints as string[],
        suggestionPoints: matchAnalysis.suggestionPoints as string[],
        summary: matchAnalysis.summary ?? ""
      }
    });

    const version = await createInterviewOutputVersion(
      projectId,
      userId,
      `高频追问清单 · ${project.name}`,
      { type: "INTERVIEW_QUESTIONS", ...result },
      projectCard.id,
      matchAnalysis.id,
      matchAnalysis.jdRecordId
    );

    revalidatePath("/interview-prep");

    return {
      success: true,
      message: "高频追问清单已生成并保存为输出版本。",
      questions: result.questions,
      savedAt: version.createdAt.toISOString(),
      model: result.model
    };
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : "生成高频追问清单失败，请稍后再试。"
    };
  }
}
