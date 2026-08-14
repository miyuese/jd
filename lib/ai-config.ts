import { generateText, streamText } from "ai";
import type { LanguageModel } from "ai";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { getActiveAiProviderConfig } from "@/lib/ai-config-data";
import { extractJsonFromText, normalizeStringArray, extractString, extractStringArray } from "@/lib/ai-json";

export const requiredAiEnvKeys = ["AI_API_BASE_URL", "AI_API_KEY", "AI_MODEL"] as const;

type RequiredAiEnvKey = (typeof requiredAiEnvKeys)[number];

export function getMissingAiEnvKeys(): RequiredAiEnvKey[] {
  return requiredAiEnvKeys.filter((key) => !process.env[key]);
}

export function getAiConfigStatus() {
  const missingKeys = getMissingAiEnvKeys();

  return {
    isConfigured: missingKeys.length === 0,
    missingKeys,
    baseURL: process.env.AI_API_BASE_URL ?? "",
    model: process.env.AI_MODEL ?? "",
    providerName: process.env.AI_PROVIDER_NAME ?? "openai-compatible"
  };
}

function getAiProvider() {
  const missingKeys = getMissingAiEnvKeys();

  if (missingKeys.length > 0) {
    throw new Error(`缺少 AI 环境变量：${missingKeys.join("、")}`);
  }

  return createOpenAICompatible({
    name: process.env.AI_PROVIDER_NAME ?? "openai-compatible",
    baseURL: process.env.AI_API_BASE_URL!,
    apiKey: process.env.AI_API_KEY!
  });
}

function createSandboxModel() {
  const provider = getAiProvider();
  return provider(process.env.AI_MODEL!);
}

export function createAiModel() {
  return createSandboxModel();
}

// ========== 模型配置解析（DB 优先，环境变量兜底） ==========

type NamedModel = {
  model: LanguageModel;
  name: string;
};

/**
 * 返回按优先级排序的模型列表：[主模型, ...备用模型]。
 * 优先级：数据库配置（设置页可改，改完立即生效）> 环境变量（AI_MODEL + AI_FALLBACK_MODELS）。
 */
async function getConfigModels(): Promise<NamedModel[]> {
  try {
    const dbConfig = await getActiveAiProviderConfig();

    if (dbConfig) {
      const provider = createOpenAICompatible({
        name: dbConfig.providerName,
        baseURL: dbConfig.baseURL,
        apiKey: dbConfig.apiKey
      });
      const names = [dbConfig.primaryModel, ...(dbConfig.fallbackModels ?? [])].filter(Boolean);

      if (names.length > 0) {
        return names.map((name) => ({ model: provider(name), name }));
      }
    }
  } catch (error) {
    console.warn("[AI config] 读取数据库配置失败，回退环境变量:", error);
  }

  const provider = getAiProvider();

  const names = [
    process.env.AI_MODEL ?? "",
    ...(process.env.AI_FALLBACK_MODELS ?? "")
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean)
  ].filter(Boolean);

  return names.map((name) => ({ model: provider(name), name }));
}

/**
 * 带 fallback 的 AI 生成入口：主模型失败自动切换备用模型。
 * 所有 AI 功能统一走这个函数，演示时模型挂了会自动降级而不是当场报错。
 */
export async function generateTextRobust(
  input: Omit<Parameters<typeof generateText>[0], "model">
): Promise<{ text: string; usedModel: string }> {
  const models = await getConfigModels();

  let lastError: unknown = null;

  for (let i = 0; i < models.length; i += 1) {
    try {
      const result = await generateText({
        ...input,
        model: models[i].model
      } as Parameters<typeof generateText>[0]);
      return { text: result.text, usedModel: models[i].name };
    } catch (error) {
      lastError = error;
      console.warn(`[AI fallback] 第 ${i + 1} 个模型 ${models[i].name} 调用失败: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error("所有 AI 模型均调用失败，请检查模型配置或稍后再试。");
}

type StructuredCallOptions = {
  system: string;
  prompt: string;
  maxOutputTokens: number;
  temperature?: number;
  /** 校验解析结果是否可用；返回 false 表示格式不合格，触发重试 */
  validate: (parsed: unknown) => boolean;
  /** 额外重试次数（首次调用之外），默认 1 次 */
  extraRetries?: number;
};

/**
 * 结构化 JSON 生成入口：模型调用 + 容错 JSON 提取 + 格式校验。
 * 模型「返回了内容但格式不对」时（JSON 解析失败 / 字段缺失），
 * 会额外重试 1-2 次（重试会重新走模型列表，天然带上备用模型），
 * 避免"格式错误直接抛给用户、只能手动重试"的脆弱体验。
 */
export async function generateStructuredJson<T>(
  options: StructuredCallOptions & { parse: (parsed: unknown) => T }
): Promise<{ data: T; model: string }> {
  const retries = options.extraRetries ?? 1;

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    const result = await generateTextRobust({
      system: options.system,
      prompt: options.prompt,
      maxOutputTokens: options.maxOutputTokens,
      ...(options.temperature !== undefined ? { temperature: options.temperature } : {})
    });

    let parsed: unknown;

    try {
      parsed = extractJsonFromText(result.text);
    } catch (error) {
      if (attempt < retries) {
        console.warn(`[AI 结构化输出] 第 ${attempt + 1} 次 JSON 提取失败，准备重试: ${error instanceof Error ? error.message : String(error)}`);
        continue;
      }
      throw error;
    }

    if (options.validate(parsed)) {
      return { data: options.parse(parsed), model: result.usedModel };
    }

    if (attempt < retries) {
      console.warn(`[AI 结构化输出] 第 ${attempt + 1} 次格式校验未通过，准备重试`);
    } else {
      throw new Error("模型返回内容格式不符合要求，请稍后再试。");
    }
  }

  // 理论上不会走到这里（上面必然 return 或 throw），仅作类型收口
  throw new Error("模型返回内容格式不符合要求，请稍后再试。");
}

/** 测试一组模型配置是否可用（设置页「测试连接」用，不写入数据库）。 */
export async function testModelConnection(input: {
  providerName?: string;
  baseURL: string;
  apiKey: string;
  model: string;
}) {
  try {
    const provider = createOpenAICompatible({
      name: input.providerName ?? "openai-compatible",
      baseURL: input.baseURL,
      apiKey: input.apiKey
    });

    const { text } = await generateText({
      model: provider(input.model),
      system: "你是连接测试助手，请只回复两个字：连通。不要输出其他内容。",
      prompt: "测试连接",
      maxOutputTokens: 20
    });

    return {
      ok: true,
      text: (text || "").slice(0, 50)
    };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

// ========== AI 功能函数（全部走 generateTextRobust） ==========

export async function generateSandboxReply(prompt: string) {
  try {
    const result = await generateTextRobust({
      system:
        "你是一个用于验证模型连通性的测试助手。请直接回答用户问题，优先使用简体中文，保持清晰、自然、不要输出多余前缀。",
      prompt,
      maxOutputTokens: 400
    });

    if (!result.text.trim()) {
      throw new Error("模型接口已返回成功状态，但没有产出可展示的文本内容。请切换模型后再试。");
    }

    return {
      text: result.text,
      model: result.usedModel
    };
  } catch (error) {
    console.error("generateSandboxReply error:", error);
    throw error;
  }
}

export async function generateInterviewQuestions(input: {
  projectName: string;
  targetRole: string;
  currentNeed: string;
  materialText: string;
}) {
  const result = await generateStructuredJson({
    system:
      "你是一个求职项目复盘教练。你要根据项目原始材料，输出采访式追问，帮助用户把真实经历讲清楚。你必须只返回 JSON，不要输出解释、标题或 Markdown 代码块。",
    prompt: `请基于下面信息生成首轮采访问题。\n\n项目名称：${input.projectName}\n目标岗位：${input.targetRole}\n当前需求：${input.currentNeed}\n项目原始材料：${input.materialText}\n\n输出要求：\n1. 只输出 JSON。\n2. 格式必须是 {"questions":["问题1","问题2","问题3"]}。\n3. 生成 3 到 5 条中文问题。\n4. 问题要具体，优先追问项目背景、职责、关键动作、判断依据、结果指标和协作细节。\n5. 不要输出空泛鼓励语，不要重复。`,
    maxOutputTokens: 800,
    validate: (parsed) => {
      if (typeof parsed !== "object" || parsed === null) {
        return false;
      }
      const record = parsed as { questions?: unknown };
      return Array.isArray(record.questions) && record.questions.length > 0;
    },
    parse: (parsed) => {
      const record = parsed as { questions?: unknown };
      return {
        questions: extractStringArray(record.questions)
      };
    }
  });

  return {
    questions: result.data.questions,
    model: result.model
  };
}

export async function generateProjectCardDraft(input: {
  projectName: string;
  targetRole: string;
  currentNeed: string;
  materialText?: string;
  materials?: Array<{ projectName: string; text: string }>;
  questionAnswers: Array<{
    questionText: string;
    answerText: string;
  }>;
  confirmedFields?: {
    title?: string;
    background?: string;
    responsibility?: string;
    result?: string;
  };
}) {
  const qaText = input.questionAnswers.length
    ? input.questionAnswers
        .map((item, index) => `第${index + 1}条问答\n问题：${item.questionText}\n回答：${item.answerText}`)
        .join("\n\n")
    : "当前还没有已保存问答，请主要基于项目原始材料生成草稿。";

  // 多份材料：每份带项目名标签，防"材料打架"（A 项目结果安到 B 项目）
  const materialsText = (input.materials && input.materials.length > 0
    ? input.materials
    : (input.materialText ? [{ projectName: input.projectName, text: input.materialText }] : []))
    .map((item, index) => `【材料 ${index + 1} | 项目：${item.projectName}】\n${item.text}`)
    .join("\n\n");

  const confirmedText = input.confirmedFields
    ? [
        input.confirmedFields.title ? `已确认标题：${input.confirmedFields.title}` : "",
        input.confirmedFields.background ? `已确认背景：${input.confirmedFields.background}` : "",
        input.confirmedFields.responsibility ? `已确认职责：${input.confirmedFields.responsibility}` : "",
        input.confirmedFields.result ? `已确认结果：${input.confirmedFields.result}` : ""
      ].filter(Boolean).join("\n")
    : "";

  const confirmedInstruction = confirmedText
    ? `\n\n以下字段是用户已确认的事实，必须原样保留、不得修改或推翻，只能在此基础上完善其余字段：\n${confirmedText}`
    : "";

  const result = await generateStructuredJson({
    system:
      "你是一个求职项目复盘教练。你要把项目原始材料和复盘问答整理成结构化项目卡片草稿。你必须只返回 JSON，不要输出解释、标题或 Markdown 代码块。",
    prompt: `请基于下面信息生成项目卡片草稿。\n\n项目名称：${input.projectName}\n目标岗位：${input.targetRole}\n当前需求：${input.currentNeed}\n\n项目材料（每份材料标注了所属项目，严禁把 A 项目的事实写到 B 项目的表述中）：\n${materialsText || "（暂无材料）"}\n\n已保存问答：\n${qaText}${confirmedInstruction}\n\n输出要求：\n1. 只输出 JSON。\n2. 格式必须是 {"title":"...","background":"...","responsibility":"...","result":"..."}。\n3. 所有字段都必须有内容，使用简体中文。\n4. background 聚焦项目背景、目标和问题场景。\n5. responsibility 聚焦你的职责、关键动作和决策。\n6. result 聚焦结果、效果、指标或价值。\n7. 引用多份材料时，每段表述必须归属到对应项目名，禁止跨项目混用事实。\n8. 不要编造明显超出材料的信息，不确定的地方宁可保持保守表达。`,
    maxOutputTokens: 2000,
    validate: (parsed) => {
      if (typeof parsed !== "object" || parsed === null) {
        return false;
      }
      const record = parsed as { title?: unknown; background?: unknown; responsibility?: unknown; result?: unknown };
      return (
        extractString(record.title).length > 0 &&
        extractString(record.background).length > 0 &&
        extractString(record.responsibility).length > 0 &&
        extractString(record.result).length > 0
      );
    },
    parse: (parsed) => {
      const record = parsed as { title?: unknown; background?: unknown; responsibility?: unknown; result?: unknown };
      return {
        title: extractString(record.title),
        background: extractString(record.background),
        responsibility: extractString(record.responsibility),
        result: extractString(record.result)
      };
    }
  });

  return {
    title: result.data.title,
    background: result.data.background,
    responsibility: result.data.responsibility,
    result: result.data.result,
    model: result.model
  };
}

export async function generateJdCapabilitySummary(input: { rawText: string }) {
  const result = await generateStructuredJson({
    system:
      "你是一个岗位分析助手。你要把 JD 原文提炼成结构化岗位能力摘要。你必须只返回 JSON，不要输出解释、标题或 Markdown 代码块。",
    prompt: `请基于下面的 JD 原文，输出岗位能力摘要。\n\nJD 原文：${input.rawText}\n\n输出要求：\n1. 只输出 JSON。\n2. 格式必须是 {"responsibilities":[...],"capabilities":[...],"priorities":[{"label":"...","level":"high|medium|low"}]}。\n3. responsibilities 输出 3 到 5 条岗位职责重点。\n4. capabilities 输出 4 到 8 个能力关键词。\n5. priorities 输出 3 到 5 条优先级判断。\n6. 使用简体中文。`,
    maxOutputTokens: 1200,
    validate: (parsed) => {
      if (typeof parsed !== "object" || parsed === null) {
        return false;
      }
      const record = parsed as { responsibilities?: unknown; capabilities?: unknown; priorities?: unknown };
      return (
        extractStringArray(record.responsibilities).length > 0 &&
        extractStringArray(record.capabilities).length > 0 &&
        Array.isArray(record.priorities) &&
        record.priorities.length > 0
      );
    },
    parse: (parsed) => {
      const record = parsed as {
        responsibilities?: unknown;
        capabilities?: unknown;
        priorities?: unknown;
      };
      const priorities = Array.isArray(record.priorities)
        ? record.priorities
            .filter((item): item is { label?: unknown; level?: unknown } => typeof item === "object" && item !== null)
            .map((item) => ({
              label: typeof item.label === "string" ? item.label.trim() : "",
              level: typeof item.level === "string" ? item.level.trim() : "medium"
            }))
            .filter((item) => item.label)
        : [];

      return {
        responsibilities: extractStringArray(record.responsibilities),
        capabilities: extractStringArray(record.capabilities),
        priorities
      };
    }
  });

  return {
    responsibilities: result.data.responsibilities,
    capabilities: result.data.capabilities,
    priorities: result.data.priorities,
    model: result.model
  };
}

export async function generateMatchAnalysisDraft(input: {
  projectCard: {
    title: string;
    background: string;
    responsibility: string;
    result: string;
  };
  capabilitySummary: {
    responsibilities: string[];
    capabilities: string[];
    priorities: Array<{ label: string; level: string }>;
  };
}) {
  const projectFactDigest = [
    `项目标题：${input.projectCard.title}`,
    `项目背景：${input.projectCard.background}`,
    `核心职责：${input.projectCard.responsibility}`,
    `项目结果：${input.projectCard.result}`
  ].join("\n");
  const generationBatch = `${new Date().toISOString()}-${Math.random().toString(36).slice(2, 8)}`;

  const result = await generateStructuredJson({
    system:
      "你是一个求职匹配分析助手。你要基于项目卡片和 JD 能力摘要，输出结构化匹配分析草稿。你必须只返回 JSON，不要输出解释、标题或 Markdown 代码块。",
    prompt: `请基于下面信息生成一版新的 JD 匹配分析草稿。\n\n本次生成批次：${generationBatch}\n请不要照搬上一版表达，优先换一个分析角度、换一组措辞和排序，但必须保持事实真实，不要编造项目事实。\n\n项目事实：\n${projectFactDigest}\n\nJD 职责重点：${input.capabilitySummary.responsibilities.join("；")}\nJD 能力关键词：${input.capabilitySummary.capabilities.join("；")}\nJD 优先级：${input.capabilitySummary.priorities.map((item) => `${item.label}(${item.level})`).join("；")}\n\n输出要求：\n1. 只输出合法 JSON，不要输出 Markdown，不要输出代码块，不要输出解释性前后缀。\n2. 顶层 JSON 必须包含且优先只包含这 4 个字段：{"matchedPoints":[],"gapPoints":[],"suggestionPoints":[],"summary":""}。\n3. matchedPoints、gapPoints、suggestionPoints 每个数组必须恰好 3 条，避免输出过长导致 JSON 被截断。\n4. 数组里的每一项可以是字符串，也可以是对象；更推荐对象格式：{"point":"一句明确结论","evidence":"来自项目事实或 JD 要求的具体证据"}。\n5. 如果使用对象格式，每个 point 控制在 45 个汉字以内，每个 evidence 控制在 70 个汉字以内；不要写长段落。\n6. matchedPoints 写"项目与 JD 的强匹配点"，每条说明匹配了 JD 的哪个职责、能力或优先级，并引用项目中的具体动作、模块、结果或决策。\n7. gapPoints 写"当前表达或证据上的缺口"，优先写表达缺口、证据缺口、量化缺口，不要简单判断用户能力不足。\n8. suggestionPoints 写"下一步可执行建议"，必须能直接指导简历改写或面试表达，每条建议要具体到怎么改、补什么证据、强化哪个角度。\n9. summary 必须是 2 到 3 句中文总结，说明整体匹配度、最值得主打的亮点、最需要补强的短板。\n10. 不要使用空数组，不要返回 null，不要把 JSON 字段名翻译成中文。\n11. 使用简体中文，表达具体、克制、可信，不要空泛套话。`,
    temperature: 0.8,
    maxOutputTokens: 3000,
    validate: (parsed) => {
      if (typeof parsed !== "object" || parsed === null) {
        return false;
      }
      const record = parsed as {
        matchedPoints?: unknown;
        gapPoints?: unknown;
        suggestionPoints?: unknown;
        summary?: unknown;
        strengths?: unknown;
        risks?: unknown;
        weaknesses?: unknown;
        recommendations?: unknown;
        nextSteps?: unknown;
      };
      const matched = normalizeStringArray(record.matchedPoints);
      const gaps = normalizeStringArray(record.gapPoints);
      const suggestions = normalizeStringArray(record.suggestionPoints);
      const aliasMatched = normalizeStringArray(record.strengths);
      const aliasGaps = normalizeStringArray(record.risks ?? record.weaknesses);
      const aliasSuggestions = normalizeStringArray(record.recommendations ?? record.nextSteps);

      return (
        (matched.length > 0 || aliasMatched.length > 0) &&
        (gaps.length > 0 || aliasGaps.length > 0) &&
        (suggestions.length > 0 || aliasSuggestions.length > 0) &&
        typeof record.summary === "string" &&
        record.summary.trim().length > 0
      );
    },
    parse: (parsed) => {
      const record = parsed as {
        matchedPoints?: unknown;
        gapPoints?: unknown;
        suggestionPoints?: unknown;
        summary?: unknown;
        strengths?: unknown;
        risks?: unknown;
        weaknesses?: unknown;
        recommendations?: unknown;
        nextSteps?: unknown;
      };
      const matchedPoints = normalizeStringArray(record.matchedPoints);
      const gapPoints = normalizeStringArray(record.gapPoints);
      const suggestionPoints = normalizeStringArray(record.suggestionPoints);
      const finalMatchedPoints = matchedPoints.length ? matchedPoints : normalizeStringArray(record.strengths);
      const finalGapPoints = gapPoints.length ? gapPoints : normalizeStringArray(record.risks ?? record.weaknesses);
      const finalSuggestionPoints = suggestionPoints.length
        ? suggestionPoints
        : normalizeStringArray(record.recommendations ?? record.nextSteps);

      return {
        matchedPoints: finalMatchedPoints,
        gapPoints: finalGapPoints,
        suggestionPoints: finalSuggestionPoints,
        summary: extractString(record.summary)
      };
    }
  });

  return {
    matchedPoints: result.data.matchedPoints,
    gapPoints: result.data.gapPoints,
    suggestionPoints: result.data.suggestionPoints,
    summary: result.data.summary,
    model: result.model
  };
}

export async function generatePlainMatchAnalysisExplanations(input: {
  matchedPoints: string[];
  gapPoints: string[];
  suggestionPoints: string[];
  summary: string;
}) {
  const pick = (items: string[], fallback: string) => items.find((item) => item.trim())?.trim() ?? fallback;
  const firstMatchedPoint = pick(input.matchedPoints, "项目里已经有一些能和岗位要求对上的经历");
  const firstGapPoint = pick(input.gapPoints, "当前表达里还有一些证据和结果没有讲透");
  const firstSuggestionPoint = pick(input.suggestionPoints, "后续可以优先把关键动作和结果补得更具体");
  const summary = input.summary.trim();

  return {
    matchedPoints: `简单说，这些匹配点说明你不是从零去贴这个岗位，项目里已经有可以主打的部分。尤其是“${firstMatchedPoint}”，后面在简历和面试里可以优先展开，讲清楚你做了什么、为什么和岗位相关。${summary ? `整体判断是：${summary}` : ""}`,
    gapPoints: `这些差距更像是“还没讲清楚”，不一定代表你没有相关能力。比如“${firstGapPoint}”，后续需要补具体证据、量化结果或决策过程，让面试官更容易相信这段经历确实支撑岗位要求。`,
    suggestionPoints: `下一步最值得先改的是把表达从概括判断落到具体动作和结果上。可以先从“${firstSuggestionPoint}”开始处理，再逐条检查匹配点是否都有项目事实支撑。`
  };
}

export async function generateResumeRewriteDraft(input: {
  resumeText: string;
  rewriteMode: "balanced" | "result-focused" | "responsibility-focused" | "jd-focused";
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
    plainExplanations?: {
      matchedPoints: string;
      gapPoints: string;
      suggestionPoints: string;
    };
  };
}) {
  const { system, prompt } = buildResumeRewritePrompt(input);

  const result = await generateStructuredJson({
    system,
    prompt,
    maxOutputTokens: 5000,
    validate: (parsed) => {
      if (typeof parsed !== "object" || parsed === null) {
        return false;
      }
      const record = parsed as { rewrite?: unknown };
      return typeof record.rewrite === "string" && record.rewrite.trim().length > 0;
    },
    parse: (parsed) => {
      const record = parsed as { rewrite?: unknown; reasoning?: unknown; highlights?: unknown };
      return {
        rewrite: extractString(record.rewrite),
        reasoning: extractString(record.reasoning),
        highlights: extractStringArray(record.highlights)
      };
    }
  });

  return {
    rewrite: result.data.rewrite,
    reasoning: result.data.reasoning,
    highlights: result.data.highlights,
    model: result.model
  };
}

/**
 * 构造简历改写的系统提示词与用户提示词（流式与非流式共用）。
 * 提示词全文保留，不做截断——通过流式输出规避 Vercel 长连接超时。
 */
export function buildResumeRewritePrompt(input: {
  resumeText: string;
  rewriteMode: "balanced" | "result-focused" | "responsibility-focused" | "jd-focused";
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
    plainExplanations?: {
      matchedPoints: string;
      gapPoints: string;
      suggestionPoints: string;
    };
  };
}): { system: string; prompt: string } {
  const modeInstructions = {
    balanced: "在职责、动作、结果之间保持平衡，整体像一段成熟的项目经历描述。",
    "result-focused": "优先强化结果、影响和业务价值，让读者更快看到项目产出。",
    "responsibility-focused": "优先强化你具体负责了什么、推进了什么、做过哪些关键动作。",
    "jd-focused": "优先使用更贴当前目标岗位的表达方式，把最相关的经历放到前面。"
  } as const;

  return {
    system:
      "你是一个简历改写助手。你要基于已确认项目事实和岗位匹配分析，生成一版更贴合目标岗位的简历项目描述。你必须只返回 JSON，不要输出解释、标题或 Markdown 代码块。",
    prompt: `请基于下面信息生成简历改写草稿。\n\n改写策略：${modeInstructions[input.rewriteMode]}\n\n已有简历内容：${input.resumeText}\n\n项目卡片标题：${input.projectCard.title}\n项目背景：${input.projectCard.background}\n核心职责：${input.projectCard.responsibility}\n项目结果：${input.projectCard.result}\n\n匹配点：${input.matchAnalysis.matchedPoints.join("；")}\n差距点：${input.matchAnalysis.gapPoints.join("；")}\n补充建议：${input.matchAnalysis.suggestionPoints.join("；")}\n匹配总结：${input.matchAnalysis.summary}\n说人话版匹配解释：${input.matchAnalysis.plainExplanations?.matchedPoints ?? ""}\n说人话版差距解释：${input.matchAnalysis.plainExplanations?.gapPoints ?? ""}\n说人话版建议解释：${input.matchAnalysis.plainExplanations?.suggestionPoints ?? ""}\n\n输出要求：\n1. 只输出 JSON。\n2. 格式必须是 {"rewrite":"...","reasoning":"...","highlights":[...]}。\n3. rewrite 必须是一段适合放进简历项目描述里的文本，优先引用项目中的具体动作、模块、协作方式和结果，不要只堆抽象能力词。\n4. rewrite 要优先突出与目标岗位最相关的职责、动作和结果，但不能编造事实。\n5. reasoning 用 1 到 3 句说明这版改写为什么更贴岗位。\n6. highlights 输出 2 到 4 条，说明相较原文主要增强了哪些重点。\n7. 使用简体中文，保持简历表达风格，不要写成分析报告。`
  };
}

/**
 * 流式简历改写：用 streamText 逐 token 输出，规避 Vercel 长请求超时。
 * 返回 textStream 与使用的模型名；模型不可用时自动降级到备用模型。
 */
export async function streamResumeRewriteDraft(input: {
  resumeText: string;
  rewriteMode: "balanced" | "result-focused" | "responsibility-focused" | "jd-focused";
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
    plainExplanations?: {
      matchedPoints: string;
      gapPoints: string;
      suggestionPoints: string;
    };
  };
}): Promise<{ textStream: AsyncIterable<string>; model: string }> {
  const { system, prompt } = buildResumeRewritePrompt(input);
  const models = await getConfigModels();

  let lastError: unknown = null;

  for (const { model, name } of models) {
    try {
      const result = streamText({
        system,
        prompt,
        maxOutputTokens: 5000,
        model
      });
      return { textStream: result.textStream, model: name };
    } catch (error) {
      lastError = error;
      console.warn(`[AI stream] 模型 ${name} 流式创建失败: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error("所有 AI 模型均调用失败，请检查模型配置或稍后再试。");
}

export async function generateResumeFragmentRewrite(input: {
  selectedText: string;
  fullResumeText: string;
  rewriteMode: "balanced" | "result-focused" | "responsibility-focused" | "jd-focused";
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
}) {
  const result = await generateStructuredJson({
    system:
      "你是一个简历片段改写助手。你要在保留原始事实的前提下，只重写用户选中的那一段文本。你必须只返回 JSON，不要输出解释、标题或 Markdown 代码块。",
    prompt: `请只重写用户选中的简历片段。\n\n改写策略：${input.rewriteMode}\n\n整份简历上下文：${input.fullResumeText}\n\n用户选中的原文片段：${input.selectedText}\n\n项目卡片标题：${input.projectCard.title}\n项目背景：${input.projectCard.background}\n核心职责：${input.projectCard.responsibility}\n项目结果：${input.projectCard.result}\n\n匹配点：${input.matchAnalysis.matchedPoints.join("；")}\n差距点：${input.matchAnalysis.gapPoints.join("；")}\n补充建议：${input.matchAnalysis.suggestionPoints.join("；")}\n匹配总结：${input.matchAnalysis.summary}\n\n输出要求：\n1. 只输出 JSON。\n2. 格式必须是 {"rewrite":"...","reasoning":"..."}。\n3. rewrite 只能针对“用户选中的原文片段”进行重写，不要重写整份简历。\n4. rewrite 要结合整份简历上下文，避免前后文风格完全断裂。\n5. 保持事实真实，不要编造。\n6. 使用简体中文，保持简历项目描述语气。`,
    maxOutputTokens: 2000,
    validate: (parsed) => {
      if (typeof parsed !== "object" || parsed === null) {
        return false;
      }
      const record = parsed as { rewrite?: unknown };
      return typeof record.rewrite === "string" && record.rewrite.trim().length > 0;
    },
    parse: (parsed) => {
      const record = parsed as { rewrite?: unknown; reasoning?: unknown };
      return {
        rewrite: extractString(record.rewrite),
        reasoning: extractString(record.reasoning)
      };
    }
  });

  return {
    rewrite: result.data.rewrite,
    reasoning: result.data.reasoning,
    model: result.model
  };
}

async function generateInterviewScript(input: {
  duration: "1-minute" | "3-minute";
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
}) {
  const durationInstruction =
    input.duration === "1-minute"
      ? "输出一段更短、更适合开场介绍的口语化讲稿。"
      : "输出一段更完整、更适合 3 分钟展开讲述的口语化讲稿。";

  const result = await generateStructuredJson({
    system:
      "你是一个面试表达助手。你要把项目事实和岗位匹配重点转成口语化项目讲稿。你必须只返回 JSON，不要输出解释、标题或 Markdown 代码块。",
    prompt: `请基于下面信息生成项目讲稿。\n\n时长要求：${durationInstruction}\n\n项目标题：${input.projectCard.title}\n项目背景：${input.projectCard.background}\n核心职责：${input.projectCard.responsibility}\n项目结果：${input.projectCard.result}\n\n匹配点：${input.matchAnalysis.matchedPoints.join("；")}\n差距点：${input.matchAnalysis.gapPoints.join("；")}\n补充建议：${input.matchAnalysis.suggestionPoints.join("；")}\n匹配总结：${input.matchAnalysis.summary}\n\n输出要求：\n1. 只输出 JSON。\n2. 格式必须是 {"script":"...","highlights":[...]}。\n3. script 必须是口语化表达，不要写成简历 bullet，也不要写成分析报告。\n4. highlights 输出 2 到 4 条，说明这版讲稿重点抓了什么。\n5. 使用简体中文。`,
    maxOutputTokens: input.duration === "1-minute" ? 2000 : 3000,
    validate: (parsed) => {
      if (typeof parsed !== "object" || parsed === null) {
        return false;
      }
      const record = parsed as { script?: unknown };
      return typeof record.script === "string" && record.script.trim().length > 0;
    },
    parse: (parsed) => {
      const record = parsed as { script?: unknown; highlights?: unknown };
      return {
        script: extractString(record.script),
        highlights: extractStringArray(record.highlights)
      };
    }
  });

  return {
    script: result.data.script,
    highlights: result.data.highlights,
    model: result.model
  };
}

export async function generateOneMinuteIntro(input: {
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
}) {
  return generateInterviewScript({ ...input, duration: "1-minute" });
}

export async function generateThreeMinuteStory(input: {
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
}) {
  return generateInterviewScript({ ...input, duration: "3-minute" });
}

export async function generateInterviewQuestionsList(input: {
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
}) {
  const result = await generateStructuredJson({
    system:
      "你是一个面试追问助手。你要基于项目事实和岗位匹配重点，输出一组高频追问问题。你必须只返回 JSON，不要输出解释、标题或 Markdown 代码块。",
    prompt: `请基于下面信息生成面试高频追问清单。\n\n项目标题：${input.projectCard.title}\n项目背景：${input.projectCard.background}\n核心职责：${input.projectCard.responsibility}\n项目结果：${input.projectCard.result}\n\n匹配点：${input.matchAnalysis.matchedPoints.join("；")}\n差距点：${input.matchAnalysis.gapPoints.join("；")}\n补充建议：${input.matchAnalysis.suggestionPoints.join("；")}\n匹配总结：${input.matchAnalysis.summary}\n\n输出要求：\n1. 只输出 JSON。\n2. 格式必须是 {"questions":[...]}。\n3. 输出 6 到 10 条中文问题。\n4. 问题要覆盖背景真实性、职责边界、关键决策、结果指标、岗位贴合点等方向。`,
    maxOutputTokens: 2500,
    validate: (parsed) => {
      if (typeof parsed !== "object" || parsed === null) {
        return false;
      }
      const record = parsed as { questions?: unknown };
      return Array.isArray(record.questions) && record.questions.length > 0;
    },
    parse: (parsed) => {
      const record = parsed as { questions?: unknown };
      return {
        questions: extractStringArray(record.questions)
      };
    }
  });

  return {
    questions: result.data.questions,
    model: result.model
  };
}
