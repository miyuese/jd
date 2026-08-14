import { NextRequest, NextResponse } from "next/server";
import { requireClerkUserId } from "@/lib/auth-scope";
import { streamResumeRewriteDraft } from "@/lib/ai-config";
import { getWorkspaceProjectById } from "@/lib/neon-db";
import { getLatestProjectCard, listProjectCards } from "@/lib/stage7-data";
import { getLatestMatchAnalysis, getMatchAnalysisByJdRecord } from "@/lib/stage8-data";
import { createInterviewOutputVersion } from "@/lib/stage10-data";

// 长输入 + 流式生成需要足够执行时长（Vercel Hobby 上限 300s）
export const maxDuration = 300;
export const runtime = "nodejs";

const rewriteModes = ["balanced", "result-focused", "responsibility-focused", "jd-focused"] as const;

type RewriteMode = (typeof rewriteModes)[number];

/**
 * 流式简历改写 API。
 * 与 generateResumeRewriteAction 逻辑等价，但改为 SSE 流式输出：
 * - 每个 JSON chunk 通过 data: 行推送，浏览器持续收到数据，规避 Vercel 长连接超时
 * - 流结束后保存输出版本，通过 [DONE] 标记返回保存结果
 *
 * 前端消费方式见 components/resume-rewrite-workspace.tsx 的 handleGenerateRewrite。
 */
export async function POST(request: NextRequest) {
  let userId: string;

  try {
    userId = requireClerkUserId();
  } catch {
    return NextResponse.json({ error: "未登录，无法生成简历改写。" }, { status: 401 });
  }

  let body: { projectId?: unknown; resumeText?: unknown; rewriteMode?: unknown; jdId?: unknown; cardId?: unknown };

  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "请求体格式错误。" }, { status: 400 });
  }

  const projectId = typeof body.projectId === "string" ? body.projectId : "";
  const resumeText = typeof body.resumeText === "string" ? body.resumeText : "";
  const rewriteMode = typeof body.rewriteMode === "string" ? body.rewriteMode : "";
  const jdId = typeof body.jdId === "string" && body.jdId ? body.jdId : undefined;
  const cardId = typeof body.cardId === "string" && body.cardId ? body.cardId : undefined;

  if (!projectId) {
    return NextResponse.json({ error: "缺少项目信息，请重新选择项目。" }, { status: 400 });
  }

  if (!resumeText.trim()) {
    return NextResponse.json({ error: "请先在简历材料页保存已有简历内容，再回来生成改写草稿。" }, { status: 400 });
  }

  if (!rewriteModes.includes(rewriteMode as RewriteMode)) {
    return NextResponse.json({ error: "改写策略无效。" }, { status: 400 });
  }

  const [project, projectCard, matchAnalysis] = await Promise.all([
    getWorkspaceProjectById(projectId, userId),
    cardId ? resolveCardById(cardId, userId) : getLatestProjectCard(projectId, userId),
    jdId ? getMatchAnalysisByJdRecord(jdId, userId, cardId) : getLatestMatchAnalysis(projectId, userId)
  ]);

  if (!project) {
    return NextResponse.json({ error: "当前项目不存在，或你无权为该项目生成简历改写。" }, { status: 400 });
  }

  if (!projectCard) {
    return NextResponse.json({ error: "请先完成项目卡片确认，再开始简历改写。" }, { status: 400 });
  }

  if (!matchAnalysis) {
    return NextResponse.json({ error: "请先完成 JD 匹配分析，再开始简历改写。" }, { status: 400 });
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (data: unknown) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
      };

      let fullText = "";
      let usedModel = "";

      try {
        const { textStream, model } = await streamResumeRewriteDraft({
          resumeText,
          rewriteMode: rewriteMode as RewriteMode,
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

        usedModel = model;

        // 逐 chunk 转发，前端实时显示
        for await (const chunk of textStream) {
          fullText += chunk;
          send({ type: "chunk", text: chunk });
        }

        // 流结束：解析完整 JSON
        const parsed = parseRewriteJson(fullText);

        if (!parsed) {
          send({ type: "error", message: "模型返回内容格式不符合要求，请稍后再试。" });
          controller.close();
          return;
        }

        // 保存输出版本（与 generateResumeRewriteAction 一致）
        const version = await createInterviewOutputVersion(
          projectId,
          userId,
          `简历改写 · ${rewriteModeLabels[rewriteMode as RewriteMode]} · ${project.name}`,
          {
            type: "RESUME_REWRITE",
            rewriteMode,
            rewrite: parsed.rewrite,
            reasoning: parsed.reasoning,
            highlights: parsed.highlights,
            memoryEnhanced: false
          },
          projectCard.id,
          matchAnalysis.id,
          matchAnalysis.jdRecordId
        );

        send({
          type: "done",
          rewrite: parsed.rewrite,
          reasoning: parsed.reasoning,
          highlights: parsed.highlights,
          model: usedModel,
          savedAt: version.createdAt instanceof Date ? version.createdAt.toISOString() : String(version.createdAt),
          message: "简历改写草稿已生成并保存为输出版本，可以对照原文判断是否应用到当前简历上下文。"
        });

        controller.close();
      } catch (error) {
        console.error("简历改写流式生成失败:", error);
        const msg = error instanceof Error ? error.message : "生成失败，请稍后再试。";
        send({ type: "error", message: msg });
        controller.close();
      }
    }
  });

  return new NextResponse(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no"
    }
  });
}

const rewriteModeLabels: Record<RewriteMode, string> = {
  balanced: "平衡版",
  "result-focused": "结果优先",
  "responsibility-focused": "职责优先",
  "jd-focused": "岗位贴合"
};

/** 按 id 解析用户的一张项目卡片（支持跨项目选择，供交叉点改写用）。 */
async function resolveCardById(cardId: string, userId: string) {
  const cards = await listProjectCards(userId);
  return cards.find((card) => card.id === cardId) ?? null;
}

/** 从完整流文本中提取简历改写 JSON（多层兜底，与 lib/ai-json.ts 一致）。 */
function parseRewriteJson(text: string): { rewrite: string; reasoning: string; highlights: string[] } | null {
  const normalized = text
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/```$/i, "")
    .trim();

  if (!normalized) {
    return null;
  }

  const candidates = [normalized];

  const firstBrace = normalized.indexOf("{");
  if (firstBrace >= 0) {
    candidates.push(normalized.slice(firstBrace));
  }

  const lastBrace = normalized.lastIndexOf("{");
  if (lastBrace >= 0 && lastBrace !== firstBrace) {
    candidates.push(normalized.slice(lastBrace));
  }

  for (const candidate of candidates) {
    try {
      const parsed = JSON.parse(candidate) as {
        rewrite?: unknown;
        reasoning?: unknown;
        highlights?: unknown;
      };

      const rewrite = typeof parsed.rewrite === "string" ? parsed.rewrite.trim() : "";

      if (!rewrite) {
        continue;
      }

      const reasoning = typeof parsed.reasoning === "string" ? parsed.reasoning.trim() : "";
      const highlights = Array.isArray(parsed.highlights)
        ? parsed.highlights.filter((item): item is string => typeof item === "string").map((item) => item.trim()).filter(Boolean)
        : [];

      return { rewrite, reasoning, highlights };
    } catch {
      // 继续尝试下一个候选
    }
  }

  return null;
}
