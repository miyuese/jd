import "server-only";

import { z } from "zod";
import { generateStructuredJson, generateTextRobust } from "@/lib/ai-config";
import { extractJsonFromText, extractStringArray } from "@/lib/ai-json";
import type { AbilityCategory, TagStatus } from "@/lib/memory-data";

// ========== 能力标签抽取 ==========

const abilitySchema = z.object({
  name: z.string().min(1).max(50),
  category: z.enum(["PERSONA", "GENERAL", "ROLE_SPECIFIC"]),
  confidence: z.number().min(0).max(1),
  description: z.string().optional(),
  evidenceChunkIds: z.array(z.string()).max(10)
});

const extractOutputSchema = z.object({
  abilities: z.array(abilitySchema).max(50)
});

export type ExtractedAbility = {
  name: string;
  category: AbilityCategory;
  confidence: number;
  description?: string;
  evidenceChunkIds: string[];
};

/**
 * 从模型原始输出中提取 JSON 对象（见 lib/ai-json.ts 的多层兜底实现）。
 * 部分模型（如 deepseek-v4-flash）会先输出分析过程再输出 JSON，
 * 或者因 token 上限被截断在分析中途，兜底解析尽量抢救合法 JSON。
 */

export async function extractAbilityTags(input: {
  chunks: Array<{ id: string; content: string }>;
  targetRole?: string;
}): Promise<ExtractedAbility[]> {
  const chunksText = input.chunks
    .map((chunk, index) => `【片段 ${index + 1} | id:${chunk.id}】\n${chunk.content}`)
    .join("\n\n");

  const roleLine = input.targetRole ? `目标岗位：${input.targetRole}\n` : "";

  const llm = await generateTextRobust({
    system:
      "你是一个个人能力画像分析师。你只输出一个合法的 JSON 对象，禁止输出任何解释、分析过程、标题或 Markdown 代码块。不要思考过程，直接给出最终 JSON。",
    prompt: `请从下面的用户材料中提取能力标签。\n\n${roleLine}\n材料片段：\n${chunksText}\n\n输出要求：\n1. 输出必须是单个合法 JSON 对象，第一个字符就是 {，最后一个字符就是 }。\n2. 格式：{"abilities":[{"name":"能力名","category":"PERSONA|GENERAL|ROLE_SPECIFIC","confidence":0到1的数字,"description":"一句话说明这个能力的证据","evidenceChunkIds":["片段id"]}]}\n3. category 含义：PERSONA=人物综合素质（抗压、自驱、沟通等）；GENERAL=通用能力（数据分析、项目管理、产品思维等）；ROLE_SPECIFIC=特定岗位能力（如 AI 产品经理的提示词工程、模型评估等）。\n4. 每个标签的 evidenceChunkIds 必须引用最能支撑该标签的材料片段 id，最多 3 个。\n5. confidence 表示你对这个标签可信度的判断，低于 0.5 的不要输出。\n6. 抽取 5 到 15 个标签。\n7. 严禁编造材料中不存在的能力。\n8. 直接输出 JSON，不要有任何前言或后记。`,
    maxOutputTokens: 3000
  });
  const { text } = llm;

  let parsed: unknown;

  try {
    parsed = extractJsonFromText(text);
  } catch {
    throw new Error("模型返回内容无法解析为能力标签，请重试或更换模型。");
  }

  const result = extractOutputSchema.safeParse(parsed);

  if (!result.success) {
    throw new Error("模型返回的能力标签格式不符合要求，请重试或更换模型。");
  }

  const validChunkIds = new Set(input.chunks.map((chunk) => chunk.id));

  return result.data.abilities
    .map((ability) => ({
      name: ability.name,
      category: ability.category,
      confidence: ability.confidence,
      description: ability.description,
      evidenceChunkIds: ability.evidenceChunkIds.filter((id) => validChunkIds.has(id))
    }))
    .filter((ability) => ability.evidenceChunkIds.length > 0);
}

// ========== 面试反馈 → 能力缺口 ==========

const gapSchema = z.object({
  gaps: z.array(
    z.object({
      name: z.string().min(1).max(50),
      reason: z.string().min(1),
      relatedAbility: z.string().optional()
    })
  ).max(10)
});

export type ExtractedGap = {
  name: string;
  reason: string;
  relatedAbility?: string;
};

export async function extractGapTagsFromFeedback(input: {
  feedbackText: string;
  existingAbilityNames: string[];
}): Promise<ExtractedGap[]> {
  const llm = await generateTextRobust({
    system:
      "你是一个面试复盘分析师。你要从面试反馈中提取用户被追问卡住、暴露不足的能力缺口。你必须只返回 JSON，不要输出解释、标题或 Markdown 代码块。",
    prompt: `请从下面的面试反馈中提取能力缺口。\n\n面试反馈：\n${input.feedbackText}\n\n已知能力标签：${input.existingAbilityNames.join("、") || "无"}\n\n输出要求：\n1. 只输出 JSON。\n2. 格式必须是 {"gaps":[{"name":"缺口能力名","reason":"为什么是缺口，一句说明","relatedAbility":"对应已有标签名（若有）"}]}。\n3. 只提取反馈中真实暴露的不足，不要臆测。\n4. 输出 1 到 5 条。\n5. relatedAbility 若与已有标签对应则填标签名，否则省略。`,
    maxOutputTokens: 800
  });
  const { text } = llm;

  let parsed: unknown;

  try {
    parsed = extractJsonFromText(text);
  } catch {
    throw new Error("模型返回内容无法解析为能力缺口，请重试或更换模型。");
  }

  const result = gapSchema.safeParse(parsed);

  if (!result.success) {
    throw new Error("模型返回的能力缺口格式不符合要求，请重试或更换模型。");
  }

  return result.data.gaps;
}

// ========== 按 JD 调用：带证据引用的简历改写 ==========

export type JdCallResult = {
  rewrite: string;
  reasoning: string;
  highlights: string[];
  citations: Array<{
    sentenceId: string;
    chunkId: string;
    kind: "DIRECT_QUOTE" | "PARAPHRASE" | "INFERENCE";
  }>;
  model: string;
};

export async function generateResumeWithMemory(input: {
  resumeText: string;
  projectCard: {
    title: string;
    background: string;
    responsibility: string;
    result: string;
  };
  matchAnalysis: {
    matchedPoints: string[];
    gapPoints: string[];
    suggestionPoints: string[];
    summary: string;
  };
  memoryEvidence: Array<{
    chunkId: string;
    content: string;
    tagName?: string;
  }>;
}): Promise<JdCallResult> {
  const evidenceText = input.memoryEvidence.length
    ? input.memoryEvidence
        .map((item, index) => `【证据 ${index + 1} | id:${item.chunkId} | 标签:${item.tagName ?? "无"}】\n${item.content}`)
        .join("\n\n")
    : "（暂无匹配的记忆证据）";

  const result = await generateStructuredJson({
    system:
      "你是一个简历改写助手。你要基于项目事实、岗位匹配分析和用户记忆库中的证据，生成一版贴合目标岗位的简历项目描述。你必须只返回 JSON，不要输出解释、标题或 Markdown 代码块。",
    prompt: `请基于下面信息生成简历改写草稿，并标注每句话的证据引用。\n\n已有简历内容：${input.resumeText}\n\n项目卡片标题：${input.projectCard.title}\n项目背景：${input.projectCard.background}\n核心职责：${input.projectCard.responsibility}\n项目结果：${input.projectCard.result}\n\n匹配点：${input.matchAnalysis.matchedPoints.join("；")}\n差距点：${input.matchAnalysis.gapPoints.join("；")}\n补充建议：${input.matchAnalysis.suggestionPoints.join("；")}\n匹配总结：${input.matchAnalysis.summary}\n\n记忆库证据（可引用，不得超出此范围编造）：\n${evidenceText}\n\n输出要求：\n1. 只输出 JSON。\n2. 格式必须是 {"rewrite":"...","reasoning":"...","highlights":[...],"citations":[{"sentenceId":"s1","chunkId":"证据id","kind":"DIRECT_QUOTE|PARAPHRASE|INFERENCE"}]}。\n3. rewrite 必须是一段适合放进简历项目描述里的文本，优先引用项目中的具体动作、模块、协作方式和结果。\n4. citations 中：直接来自证据原文的标 DIRECT_QUOTE；基于证据改写的标 PARAPHRASE；无法对应任何证据的推断标 INFERENCE（这类句子应尽量少）。\n5. 句子编号规则：把 rewrite 按句号/分号拆成多个句子，第一句是 s1，第二句是 s2，以此类推，citations 里的 sentenceId 对应这些编号。\n6. 不得编造事实。\n7. 使用简体中文，保持简历表达风格。`,
    maxOutputTokens: 5000,
    validate: (parsed) => {
      if (typeof parsed !== "object" || parsed === null) {
        return false;
      }
      const record = parsed as { rewrite?: unknown };
      return typeof record.rewrite === "string" && record.rewrite.trim().length > 0;
    },
    parse: (parsed) => {
      const record = parsed as {
        rewrite?: unknown;
        reasoning?: unknown;
        highlights?: unknown;
        citations?: unknown;
      };
      return {
        rewrite: typeof record.rewrite === "string" ? record.rewrite.trim() : "",
        reasoning: typeof record.reasoning === "string" ? record.reasoning.trim() : "",
        highlights: extractStringArray(record.highlights),
        citations: Array.isArray(record.citations)
          ? record.citations
              .filter(
                (item): item is { sentenceId?: unknown; chunkId?: unknown; kind?: unknown } =>
                  typeof item === "object" && item !== null
              )
              .map((item) => {
                const kind: "DIRECT_QUOTE" | "PARAPHRASE" | "INFERENCE" =
                  item.kind === "DIRECT_QUOTE" || item.kind === "PARAPHRASE" || item.kind === "INFERENCE"
                    ? item.kind
                    : "PARAPHRASE";
                return {
                  sentenceId: typeof item.sentenceId === "string" ? item.sentenceId : "",
                  chunkId: typeof item.chunkId === "string" ? item.chunkId : "",
                  kind
                };
              })
              .filter((citation) => citation.sentenceId && citation.chunkId)
          : []
      };
    }
  });

  const validChunkIds = new Set(input.memoryEvidence.map((item) => item.chunkId));

  return {
    rewrite: result.data.rewrite,
    reasoning: result.data.reasoning,
    highlights: result.data.highlights,
    citations: result.data.citations.filter((citation) => validChunkIds.has(citation.chunkId)),
    model: result.model
  };
}
