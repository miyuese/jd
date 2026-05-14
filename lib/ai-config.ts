import { generateText } from "ai";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";

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

function normalizeJsonText(value: string) {
  return value.replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/```$/i, "").trim();
}

function normalizeStringArray(value: unknown) {
  if (Array.isArray(value)) {
    return value.filter((item): item is string => typeof item === "string").map((item) => item.trim()).filter(Boolean);
  }

  if (typeof value === "string") {
    return value
      .split(/\r?\n|[；;]/)
      .map((item) => item.replace(/^[-*\d.、\s]+/, "").trim())
      .filter(Boolean);
  }

  return [];
}

function ensureAtLeastItems(items: string[], fallbackItems: string[], minimum = 3) {
  const next = [...items];

  for (const item of fallbackItems) {
    if (next.length >= minimum) {
      break;
    }

    if (!next.includes(item)) {
      next.push(item);
    }
  }

  return next;
}

export async function generateSandboxReply(prompt: string) {
  try {
    const { text } = await generateText({
      model: createSandboxModel(),
      system:
        "你是一个用于验证模型连通性的测试助手。请直接回答用户问题，优先使用简体中文，保持清晰、自然、不要输出多余前缀。",
      prompt,
      maxOutputTokens: 400
    });

    if (!text.trim()) {
      throw new Error("模型接口已返回成功状态，但没有产出可展示的文本内容。请切换模型后再试。");
    }

    return {
      text,
      model: process.env.AI_MODEL ?? ""
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
  const { text } = await generateText({
    model: createSandboxModel(),
    system:
      "你是一个求职项目复盘教练。你要根据项目原始材料，输出采访式追问，帮助用户把真实经历讲清楚。你必须只返回 JSON，不要输出解释、标题或 Markdown 代码块。",
    prompt: `请基于下面信息生成首轮采访问题。\n\n项目名称：${input.projectName}\n目标岗位：${input.targetRole}\n当前需求：${input.currentNeed}\n项目原始材料：${input.materialText}\n\n输出要求：\n1. 只输出 JSON。\n2. 格式必须是 {"questions":["问题1","问题2","问题3"]}。\n3. 生成 3 到 5 条中文问题。\n4. 问题要具体，优先追问项目背景、职责、关键动作、判断依据、结果指标和协作细节。\n5. 不要输出空泛鼓励语，不要重复。`,
    maxOutputTokens: 600
  });

  const normalizedText = normalizeJsonText(text);

  if (!normalizedText) {
    throw new Error("模型没有返回可解析的问题内容，请稍后再试。\n");
  }

  let parsed: { questions?: unknown };

  try {
    parsed = JSON.parse(normalizedText) as { questions?: unknown };
  } catch {
    throw new Error("模型返回内容无法解析为问题列表，请重试或更换模型。");
  }

  const questions = Array.isArray(parsed.questions)
    ? parsed.questions.filter((item): item is string => typeof item === "string").map((item) => item.trim()).filter(Boolean)
    : [];

  if (questions.length === 0) {
    throw new Error("模型没有生成有效问题，请补充项目材料后再试。");
  }

  return {
    questions,
    model: process.env.AI_MODEL ?? ""
  };
}

export async function generateProjectCardDraft(input: {
  projectName: string;
  targetRole: string;
  currentNeed: string;
  materialText: string;
  questionAnswers: Array<{
    questionText: string;
    answerText: string;
  }>;
}) {
  const qaText = input.questionAnswers.length
    ? input.questionAnswers
        .map((item, index) => `第${index + 1}条问答\n问题：${item.questionText}\n回答：${item.answerText}`)
        .join("\n\n")
    : "当前还没有已保存问答，请主要基于项目原始材料生成草稿。";

  const { text } = await generateText({
    model: createSandboxModel(),
    system:
      "你是一个求职项目复盘教练。你要把项目原始材料和复盘问答整理成结构化项目卡片草稿。你必须只返回 JSON，不要输出解释、标题或 Markdown 代码块。",
    prompt: `请基于下面信息生成项目卡片草稿。\n\n项目名称：${input.projectName}\n目标岗位：${input.targetRole}\n当前需求：${input.currentNeed}\n项目原始材料：${input.materialText}\n\n已保存问答：\n${qaText}\n\n输出要求：\n1. 只输出 JSON。\n2. 格式必须是 {"title":"...","background":"...","responsibility":"...","result":"..."}。\n3. 所有字段都必须有内容，使用简体中文。\n4. background 聚焦项目背景、目标和问题场景。\n5. responsibility 聚焦你的职责、关键动作和决策。\n6. result 聚焦结果、效果、指标或价值。\n7. 不要编造明显超出材料的信息，不确定的地方宁可保持保守表达。`,
    maxOutputTokens: 900
  });

  const normalizedText = normalizeJsonText(text);

  if (!normalizedText) {
    throw new Error("模型没有返回可解析的项目卡片草稿，请稍后再试。");
  }

  let parsed: {
    title?: unknown;
    background?: unknown;
    responsibility?: unknown;
    result?: unknown;
  };

  try {
    parsed = JSON.parse(normalizedText) as {
      title?: unknown;
      background?: unknown;
      responsibility?: unknown;
      result?: unknown;
    };
  } catch {
    throw new Error("模型返回内容无法解析为项目卡片草稿，请重试或更换模型。");
  }

  const title = typeof parsed.title === "string" ? parsed.title.trim() : "";
  const background = typeof parsed.background === "string" ? parsed.background.trim() : "";
  const responsibility = typeof parsed.responsibility === "string" ? parsed.responsibility.trim() : "";
  const result = typeof parsed.result === "string" ? parsed.result.trim() : "";

  if (!title || !background || !responsibility || !result) {
    throw new Error("模型生成的项目卡片字段不完整，请补充材料后再试。");
  }

  return {
    title,
    background,
    responsibility,
    result,
    model: process.env.AI_MODEL ?? ""
  };
}

export async function generateJdCapabilitySummary(input: { rawText: string }) {
  const { text } = await generateText({
    model: createSandboxModel(),
    system:
      "你是一个岗位分析助手。你要把 JD 原文提炼成结构化岗位能力摘要。你必须只返回 JSON，不要输出解释、标题或 Markdown 代码块。",
    prompt: `请基于下面的 JD 原文，输出岗位能力摘要。\n\nJD 原文：${input.rawText}\n\n输出要求：\n1. 只输出 JSON。\n2. 格式必须是 {"responsibilities":[...],"capabilities":[...],"priorities":[{"label":"...","level":"high|medium|low"}]}。\n3. responsibilities 输出 3 到 5 条岗位职责重点。\n4. capabilities 输出 4 到 8 个能力关键词。\n5. priorities 输出 3 到 5 条优先级判断。\n6. 使用简体中文。`,
    maxOutputTokens: 900
  });

  const normalizedText = normalizeJsonText(text);

  if (!normalizedText) {
    throw new Error("模型没有返回可解析的 JD 能力摘要，请稍后再试。");
  }

  let parsed: {
    responsibilities?: unknown;
    capabilities?: unknown;
    priorities?: unknown;
  };

  try {
    parsed = JSON.parse(normalizedText) as {
      responsibilities?: unknown;
      capabilities?: unknown;
      priorities?: unknown;
    };
  } catch {
    throw new Error("模型返回内容无法解析为 JD 摘要，请重试或更换模型。");
  }

  const responsibilities = Array.isArray(parsed.responsibilities)
    ? parsed.responsibilities.filter((item): item is string => typeof item === "string").map((item) => item.trim()).filter(Boolean)
    : [];
  const capabilities = Array.isArray(parsed.capabilities)
    ? parsed.capabilities.filter((item): item is string => typeof item === "string").map((item) => item.trim()).filter(Boolean)
    : [];
  const priorities = Array.isArray(parsed.priorities)
    ? parsed.priorities
        .filter((item): item is { label?: unknown; level?: unknown } => typeof item === "object" && item !== null)
        .map((item) => ({
          label: typeof item.label === "string" ? item.label.trim() : "",
          level: typeof item.level === "string" ? item.level.trim() : "medium"
        }))
        .filter((item) => item.label)
    : [];

  if (responsibilities.length === 0 || capabilities.length === 0 || priorities.length === 0) {
    throw new Error("模型生成的 JD 摘要不完整，请稍后再试。");
  }

  return {
    responsibilities,
    capabilities,
    priorities,
    model: process.env.AI_MODEL ?? ""
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
  const defaultMatchedPoints = [
    `项目背景与岗位关注的“${input.capabilitySummary.priorities[0]?.label ?? input.capabilitySummary.capabilities[0] ?? "核心职责"}”方向存在明确关联。`,
    `项目职责中已经体现了${input.capabilitySummary.capabilities.slice(0, 2).join("、") || "跨团队协作与产品推进"}等岗位关心的能力。`,
    `项目结果部分提供了可用于岗位匹配表达的落地产出与业务价值。`
  ];
  const defaultGapPoints = [
    `当前项目表达里对“${input.capabilitySummary.capabilities[0] ?? "关键能力"}”的直接证据还不够集中，需要进一步强化。`,
    `项目结果虽然有产出，但可量化指标和影响范围还可以再补充得更具体。`,
    `与 JD 中高优先级要求相比，当前卡片在方法论或专业深度表达上仍有提升空间。`
  ];
  const defaultSuggestionPoints = [
    `后续表达时优先把项目背景和岗位最关注的“${input.capabilitySummary.priorities[0]?.label ?? "核心目标"}”直接对齐。`,
    `在职责描述里补强${input.capabilitySummary.capabilities.slice(0, 2).join("、") || "关键能力"}相关动作证据，减少空泛总结。`,
    `在结果部分增加业务影响、效率提升或决策价值等量化结果，让匹配点更有说服力。`
  ];

  const projectFactDigest = [
    `项目标题：${input.projectCard.title}`,
    `项目背景：${input.projectCard.background}`,
    `核心职责：${input.projectCard.responsibility}`,
    `项目结果：${input.projectCard.result}`
  ].join("\n");

  const { text } = await generateText({
    model: createSandboxModel(),
    system:
      "你是一个求职匹配分析助手。你要基于项目卡片和 JD 能力摘要，输出结构化匹配分析草稿。你必须只返回 JSON，不要输出解释、标题或 Markdown 代码块。",
    prompt: `请基于下面信息生成匹配分析草稿。\n\n项目事实：\n${projectFactDigest}\n\nJD 职责重点：${input.capabilitySummary.responsibilities.join("；")}\nJD 能力关键词：${input.capabilitySummary.capabilities.join("；")}\nJD 优先级：${input.capabilitySummary.priorities.map((item) => `${item.label}(${item.level})`).join("；")}\n\n输出要求：\n1. 只输出 JSON。\n2. 优先使用格式 {"matchedPoints":[...],"gapPoints":[...],"suggestionPoints":[...],"summary":"..."}。\n3. 每一条 matchedPoints 必须尽量引用项目中的具体动作、模块、结果或决策，而不是只写抽象能力词。\n4. 每一条 gapPoints 优先写成“表达缺口、证据缺口、量化缺口”这类真实求职问题，而不是简单下结论说能力不足。\n5. 每一条 suggestionPoints 必须能直接指导后续简历改写或面试表达。\n6. 如果你习惯别名，也只能使用 strengths 对应 matchedPoints、risks 或 weaknesses 对应 gapPoints、recommendations 或 nextSteps 对应 suggestionPoints。\n7. 每类 points 至少输出 3 条，且不能为空。\n8. summary 用 2 到 4 句总结当前匹配情况，不能为空，并指出最值得主打的亮点和最该补的短板。\n9. 使用简体中文，表达具体，不要空泛套话。`,
    maxOutputTokens: 1200
  });

  const normalizedText = normalizeJsonText(text);

  if (!normalizedText) {
    throw new Error("模型没有返回可解析的匹配分析草稿，请稍后再试。");
  }

  let parsed: {
    matchedPoints?: unknown;
    gapPoints?: unknown;
    suggestionPoints?: unknown;
    summary?: unknown;
  };

  try {
    parsed = JSON.parse(normalizedText) as {
      matchedPoints?: unknown;
      gapPoints?: unknown;
      suggestionPoints?: unknown;
      summary?: unknown;
    };
  } catch {
    throw new Error("模型返回内容无法解析为匹配分析草稿，请重试或更换模型。");
  }

  const matchedPoints = normalizeStringArray(parsed.matchedPoints);
  const gapPoints = normalizeStringArray(parsed.gapPoints);
  const suggestionPoints = normalizeStringArray(parsed.suggestionPoints);
  const summary = typeof parsed.summary === "string" ? parsed.summary.trim() : "";

  const aliasMatchedPoints = normalizeStringArray((parsed as { strengths?: unknown }).strengths);
  const aliasGapPoints = normalizeStringArray((parsed as { risks?: unknown; weaknesses?: unknown }).risks ?? (parsed as { weaknesses?: unknown }).weaknesses);
  const aliasSuggestionPoints = normalizeStringArray((parsed as { recommendations?: unknown; nextSteps?: unknown }).recommendations ?? (parsed as { nextSteps?: unknown }).nextSteps);
  const nextMatchedPoints = matchedPoints.length ? matchedPoints : aliasMatchedPoints;
  const nextGapPoints = gapPoints.length ? gapPoints : aliasGapPoints;
  const nextSuggestionPoints = suggestionPoints.length ? suggestionPoints : aliasSuggestionPoints;

  const ensuredMatchedPoints = ensureAtLeastItems(nextMatchedPoints, defaultMatchedPoints);
  const ensuredGapPoints = ensureAtLeastItems(nextGapPoints, defaultGapPoints);
  const ensuredSuggestionPoints = ensureAtLeastItems(nextSuggestionPoints, defaultSuggestionPoints);
  const ensuredSummary =
    summary ||
    `当前项目与目标岗位存在一定匹配基础，尤其在${input.capabilitySummary.capabilities.slice(0, 2).join("、") || "核心能力"}方面具备可表达空间，但仍需要进一步补强关键证据与结果呈现。`;

  return {
    matchedPoints: ensuredMatchedPoints,
    gapPoints: ensuredGapPoints,
    suggestionPoints: ensuredSuggestionPoints,
    summary: ensuredSummary,
    model: process.env.AI_MODEL ?? ""
  };
}

export async function generatePlainMatchAnalysisExplanations(input: {
  matchedPoints: string[];
  gapPoints: string[];
  suggestionPoints: string[];
  summary: string;
}) {
  const { text } = await generateText({
    model: createSandboxModel(),
    system:
      "你是一个求职分析翻译助手。你要把正式匹配分析翻译成通俗好懂、但仍然专业的说明。你必须只返回 JSON，不要输出解释、标题或 Markdown 代码块。",
    prompt: `请把下面的匹配分析结果翻译成更通俗易懂的版本。\n\n匹配点：${input.matchedPoints.join("；")}\n差距点：${input.gapPoints.join("；")}\n补充建议：${input.suggestionPoints.join("；")}\n总结：${input.summary}\n\n输出要求：\n1. 只输出 JSON。\n2. 格式必须是 {"matchedPoints":"...","gapPoints":"...","suggestionPoints":"..."}。\n3. 每个字段写 2 到 4 句。\n4. matchedPoints 用更口语的方式解释“这些匹配点整体说明了什么，为什么值得重点讲”。\n5. gapPoints 用更口语的方式解释“这些差距更像哪里没讲清楚，后面应该补什么”。\n6. suggestionPoints 用更口语的方式解释“下一步最值得先改什么，优先顺序是什么”。\n7. 使用简体中文，不要鸡汤，不要重复原句。`,
    maxOutputTokens: 900
  });

  const normalizedText = normalizeJsonText(text);

  if (!normalizedText) {
    return {
      matchedPoints: "简单说，这组匹配点说明你的项目方向和岗位需求是对得上的，后面在简历和面试里可以优先把这部分作为主打亮点。",
      gapPoints: "这组差距不一定代表你不会，更可能是你现在还没把关键证据、量化结果和岗位语言讲清楚，后面需要重点补强这些表达。",
      suggestionPoints: "这组建议的重点不是全部重写，而是先把最能体现岗位相关性的动作和结果讲得更具体，再补上更有说服力的证据。"
    };
  }

  try {
    const parsed = JSON.parse(normalizedText) as {
      matchedPoints?: unknown;
      gapPoints?: unknown;
      suggestionPoints?: unknown;
    };

    return {
      matchedPoints:
        (typeof parsed.matchedPoints === "string" && parsed.matchedPoints.trim()) ||
        "简单说，这组匹配点说明你的项目方向和岗位需求是对得上的，后面在简历和面试里可以优先把这部分作为主打亮点。",
      gapPoints:
        (typeof parsed.gapPoints === "string" && parsed.gapPoints.trim()) ||
        "这组差距不一定代表你不会，更可能是你现在还没把关键证据、量化结果和岗位语言讲清楚，后面需要重点补强这些表达。",
      suggestionPoints:
        (typeof parsed.suggestionPoints === "string" && parsed.suggestionPoints.trim()) ||
        "这组建议的重点不是全部重写，而是先把最能体现岗位相关性的动作和结果讲得更具体，再补上更有说服力的证据。"
    };
  } catch {
    return {
      matchedPoints: "简单说，这组匹配点说明你的项目方向和岗位需求是对得上的，后面在简历和面试里可以优先把这部分作为主打亮点。",
      gapPoints: "这组差距不一定代表你不会，更可能是你现在还没把关键证据、量化结果和岗位语言讲清楚，后面需要重点补强这些表达。",
      suggestionPoints: "这组建议的重点不是全部重写，而是先把最能体现岗位相关性的动作和结果讲得更具体，再补上更有说服力的证据。"
    };
  }
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
  const modeInstructions = {
    balanced: "在职责、动作、结果之间保持平衡，整体像一段成熟的项目经历描述。",
    "result-focused": "优先强化结果、影响和业务价值，让读者更快看到项目产出。",
    "responsibility-focused": "优先强化你具体负责了什么、推进了什么、做过哪些关键动作。",
    "jd-focused": "优先使用更贴当前目标岗位的表达方式，把最相关的经历放到前面。"
  } as const;

  const { text } = await generateText({
    model: createSandboxModel(),
    system:
      "你是一个简历改写助手。你要基于已确认项目事实和岗位匹配分析，生成一版更贴合目标岗位的简历项目描述。你必须只返回 JSON，不要输出解释、标题或 Markdown 代码块。",
    prompt: `请基于下面信息生成简历改写草稿。\n\n改写策略：${modeInstructions[input.rewriteMode]}\n\n已有简历内容：${input.resumeText}\n\n项目卡片标题：${input.projectCard.title}\n项目背景：${input.projectCard.background}\n核心职责：${input.projectCard.responsibility}\n项目结果：${input.projectCard.result}\n\n匹配点：${input.matchAnalysis.matchedPoints.join("；")}\n差距点：${input.matchAnalysis.gapPoints.join("；")}\n补充建议：${input.matchAnalysis.suggestionPoints.join("；")}\n匹配总结：${input.matchAnalysis.summary}\n说人话版匹配解释：${input.matchAnalysis.plainExplanations?.matchedPoints ?? ""}\n说人话版差距解释：${input.matchAnalysis.plainExplanations?.gapPoints ?? ""}\n说人话版建议解释：${input.matchAnalysis.plainExplanations?.suggestionPoints ?? ""}\n\n输出要求：\n1. 只输出 JSON。\n2. 格式必须是 {"rewrite":"...","reasoning":"...","highlights":[...]}。\n3. rewrite 必须是一段适合放进简历项目描述里的文本，优先引用项目中的具体动作、模块、协作方式和结果，不要只堆抽象能力词。\n4. rewrite 要优先突出与目标岗位最相关的职责、动作和结果，但不能编造事实。\n5. reasoning 用 1 到 3 句说明这版改写为什么更贴岗位。\n6. highlights 输出 2 到 4 条，说明相较原文主要增强了哪些重点。\n7. 使用简体中文，保持简历表达风格，不要写成分析报告。`,
    maxOutputTokens: 1000
  });

  const normalizedText = normalizeJsonText(text);

  if (!normalizedText) {
    throw new Error("模型没有返回可解析的简历改写草稿，请稍后再试。");
  }

  let parsed: {
    rewrite?: unknown;
    reasoning?: unknown;
    highlights?: unknown;
  };

  try {
    parsed = JSON.parse(normalizedText) as {
      rewrite?: unknown;
      reasoning?: unknown;
      highlights?: unknown;
    };
  } catch {
    throw new Error("模型返回内容无法解析为简历改写草稿，请重试或更换模型。");
  }

  const rewrite = typeof parsed.rewrite === "string" ? parsed.rewrite.trim() : "";
  const reasoning = typeof parsed.reasoning === "string" ? parsed.reasoning.trim() : "";
  const highlights = Array.isArray(parsed.highlights)
    ? parsed.highlights.filter((item): item is string => typeof item === "string").map((item) => item.trim()).filter(Boolean)
    : [];

  if (!rewrite) {
    throw new Error("模型没有生成有效的简历改写草稿，请稍后再试。");
  }

  return {
    rewrite,
    reasoning,
    highlights,
    model: process.env.AI_MODEL ?? ""
  };
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
  const { text } = await generateText({
    model: createSandboxModel(),
    system:
      "你是一个简历片段改写助手。你要在保留原始事实的前提下，只重写用户选中的那一段文本。你必须只返回 JSON，不要输出解释、标题或 Markdown 代码块。",
    prompt: `请只重写用户选中的简历片段。\n\n改写策略：${input.rewriteMode}\n\n整份简历上下文：${input.fullResumeText}\n\n用户选中的原文片段：${input.selectedText}\n\n项目卡片标题：${input.projectCard.title}\n项目背景：${input.projectCard.background}\n核心职责：${input.projectCard.responsibility}\n项目结果：${input.projectCard.result}\n\n匹配点：${input.matchAnalysis.matchedPoints.join("；")}\n差距点：${input.matchAnalysis.gapPoints.join("；")}\n补充建议：${input.matchAnalysis.suggestionPoints.join("；")}\n匹配总结：${input.matchAnalysis.summary}\n\n输出要求：\n1. 只输出 JSON。\n2. 格式必须是 {"rewrite":"...","reasoning":"..."}。\n3. rewrite 只能针对“用户选中的原文片段”进行重写，不要重写整份简历。\n4. rewrite 要结合整份简历上下文，避免前后文风格完全断裂。\n5. 保持事实真实，不要编造。\n6. 使用简体中文，保持简历项目描述语气。`,
    maxOutputTokens: 700
  });

  const normalizedText = normalizeJsonText(text);

  if (!normalizedText) {
    throw new Error("模型没有返回可解析的片段改写结果，请稍后再试。");
  }

  let parsed: {
    rewrite?: unknown;
    reasoning?: unknown;
  };

  try {
    parsed = JSON.parse(normalizedText) as {
      rewrite?: unknown;
      reasoning?: unknown;
    };
  } catch {
    throw new Error("模型返回内容无法解析为片段改写结果，请重试或更换模型。");
  }

  const rewrite = typeof parsed.rewrite === "string" ? parsed.rewrite.trim() : "";
  const reasoning = typeof parsed.reasoning === "string" ? parsed.reasoning.trim() : "";

  if (!rewrite) {
    throw new Error("模型没有生成有效的片段改写结果，请稍后再试。");
  }

  return {
    rewrite,
    reasoning,
    model: process.env.AI_MODEL ?? ""
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

  const { text } = await generateText({
    model: createSandboxModel(),
    system:
      "你是一个面试表达助手。你要把项目事实和岗位匹配重点转成口语化项目讲稿。你必须只返回 JSON，不要输出解释、标题或 Markdown 代码块。",
    prompt: `请基于下面信息生成项目讲稿。\n\n时长要求：${durationInstruction}\n\n项目标题：${input.projectCard.title}\n项目背景：${input.projectCard.background}\n核心职责：${input.projectCard.responsibility}\n项目结果：${input.projectCard.result}\n\n匹配点：${input.matchAnalysis.matchedPoints.join("；")}\n差距点：${input.matchAnalysis.gapPoints.join("；")}\n补充建议：${input.matchAnalysis.suggestionPoints.join("；")}\n匹配总结：${input.matchAnalysis.summary}\n\n输出要求：\n1. 只输出 JSON。\n2. 格式必须是 {"script":"...","highlights":[...]}。\n3. script 必须是口语化表达，不要写成简历 bullet，也不要写成分析报告。\n4. highlights 输出 2 到 4 条，说明这版讲稿重点抓了什么。\n5. 使用简体中文。`,
    maxOutputTokens: input.duration === "1-minute" ? 900 : 1500
  });

  const normalizedText = normalizeJsonText(text);

  if (!normalizedText) {
    throw new Error("模型没有返回可解析的讲稿结果，请稍后再试。");
  }

  let parsed: {
    script?: unknown;
    highlights?: unknown;
  };

  try {
    parsed = JSON.parse(normalizedText) as {
      script?: unknown;
      highlights?: unknown;
    };
  } catch {
    throw new Error("模型返回内容无法解析为讲稿结果，请重试或更换模型。");
  }

  const script = typeof parsed.script === "string" ? parsed.script.trim() : "";
  const highlights = Array.isArray(parsed.highlights)
    ? parsed.highlights.filter((item): item is string => typeof item === "string").map((item) => item.trim()).filter(Boolean)
    : [];

  if (!script) {
    throw new Error("模型没有生成有效的讲稿结果，请稍后再试。");
  }

  return {
    script,
    highlights,
    model: process.env.AI_MODEL ?? ""
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
  const { text } = await generateText({
    model: createSandboxModel(),
    system:
      "你是一个面试追问助手。你要基于项目事实和岗位匹配重点，输出一组高频追问问题。你必须只返回 JSON，不要输出解释、标题或 Markdown 代码块。",
    prompt: `请基于下面信息生成面试高频追问清单。\n\n项目标题：${input.projectCard.title}\n项目背景：${input.projectCard.background}\n核心职责：${input.projectCard.responsibility}\n项目结果：${input.projectCard.result}\n\n匹配点：${input.matchAnalysis.matchedPoints.join("；")}\n差距点：${input.matchAnalysis.gapPoints.join("；")}\n补充建议：${input.matchAnalysis.suggestionPoints.join("；")}\n匹配总结：${input.matchAnalysis.summary}\n\n输出要求：\n1. 只输出 JSON。\n2. 格式必须是 {"questions":[...]}。\n3. 输出 6 到 10 条中文问题。\n4. 问题要覆盖背景真实性、职责边界、关键决策、结果指标、岗位贴合点等方向。`,
    maxOutputTokens: 900
  });

  const normalizedText = normalizeJsonText(text);

  if (!normalizedText) {
    throw new Error("模型没有返回可解析的追问清单，请稍后再试。");
  }

  let parsed: {
    questions?: unknown;
  };

  try {
    parsed = JSON.parse(normalizedText) as {
      questions?: unknown;
    };
  } catch {
    throw new Error("模型返回内容无法解析为追问清单，请重试或更换模型。");
  }

  const questions = Array.isArray(parsed.questions)
    ? parsed.questions.filter((item): item is string => typeof item === "string").map((item) => item.trim()).filter(Boolean)
    : [];

  if (!questions.length) {
    throw new Error("模型没有生成有效的追问清单，请稍后再试。");
  }

  return {
    questions,
    model: process.env.AI_MODEL ?? ""
  };
}
