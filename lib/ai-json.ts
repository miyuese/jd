/**
 * AI 输出 JSON 解析工具（纯函数，服务端/客户端均可复用）。
 *
 * 模型输出偶发不稳定：可能先输出分析过程再输出 JSON、可能被 token 截断、
 * 可能多包一层代码块。这里提供多层兜底解析，尽量从坏输出中抢救出合法 JSON。
 * 所有「要求模型返回 JSON」的 AI 功能都应使用本模块，而不是各自写一套解析。
 */

function normalizeJsonText(value: string) {
  return value
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/```$/i, "")
    .trim();
}

/**
 * 从模型原始输出中提取 JSON 对象。
 * 尝试顺序：
 * 1. 整体解析
 * 2. 截取第一个 { 到末尾
 * 3. 截取最后一个 { 到末尾（处理"分析在前、JSON 在后"或截断的情况）
 * 全部失败抛错。
 */
export function extractJsonFromText(text: string): unknown {
  const normalized = normalizeJsonText(text);

  if (!normalized) {
    throw new Error("模型没有返回可解析的内容，请稍后再试。");
  }

  // 尝试 1：整体解析
  try {
    return JSON.parse(normalized);
  } catch {
    // 继续尝试截取
  }

  // 尝试 2：找到第一个 { 开始
  const firstBrace = normalized.indexOf("{");
  if (firstBrace >= 0) {
    try {
      return JSON.parse(normalized.slice(firstBrace));
    } catch {
      // 继续尝试
    }
  }

  // 尝试 3：从最后一个 { 截取（处理"分析在前、JSON 在后"）
  const lastBrace = normalized.lastIndexOf("{");
  if (lastBrace >= 0 && lastBrace !== firstBrace) {
    try {
      return JSON.parse(normalized.slice(lastBrace));
    } catch {
      // 继续尝试
    }
  }

  throw new Error(`模型返回内容无法解析为 JSON，请重试或更换模型。原始内容前 200 字：${normalized.slice(0, 200)}`);
}

/** 标准化字符串数组：兼容纯字符串数组与对象数组（按字段提取结论文本）。 */
export function normalizeStringArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value
      .map((item) => {
        if (typeof item === "string") {
          return item.trim();
        }

        if (typeof item === "object" && item !== null) {
          const record = item as Record<string, unknown>;
          const orderedFields = [
            ["point", "结论"],
            ["evidence", "证据"],
            ["issue", "问题"],
            ["risk", "风险"],
            ["gap", "差距"],
            ["suggestion", "建议"],
            ["recommendation", "建议"],
            ["action", "行动"],
            ["reason", "原因"],
            ["detail", "细节"]
          ] as const;
          const parts = orderedFields
            .flatMap(([key, label]) => {
              const fieldValue = record[key];
              return typeof fieldValue === "string" && fieldValue.trim() ? [{ label, value: fieldValue.trim() }] : [];
            });

          if (parts.length > 0) {
            return parts.map((part) => `${part.label}：${part.value}`).join("；");
          }
        }

        return "";
      })
      .filter(Boolean);
  }

  if (typeof value === "string") {
    return value
      .split(/\r?\n|[；;]/)
      .map((item) => item.replace(/^[-*\d.、\s]+/, "").trim())
      .filter(Boolean);
  }

  return [];
}

/** 从任意值中提取纯字符串（返回空串表示缺失）。 */
export function extractString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

/** 从任意值中提取纯字符串数组（过滤非字符串项）。 */
export function extractStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter(Boolean);
}
