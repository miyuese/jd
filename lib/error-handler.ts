export type ErrorCategory = "ai" | "database" | "file" | "auth" | "validation" | "network" | "unknown";

export type CategorizedError = {
  category: ErrorCategory;
  message: string;
  suggestion: string;
};

export function categorizeError(error: unknown): CategorizedError {
  const message = error instanceof Error ? error.message : String(error);
  const lowerMessage = message.toLowerCase();

  if (lowerMessage.includes("未登录") || lowerMessage.includes("unauthorized") || lowerMessage.includes("401")) {
    return {
      category: "auth",
      message: "登录状态已过期",
      suggestion: "请重新登录后再试。"
    };
  }

  if (
    lowerMessage.includes("ai") ||
    lowerMessage.includes("模型") ||
    lowerMessage.includes("openai") ||
    lowerMessage.includes("generate") ||
    lowerMessage.includes("api") && lowerMessage.includes("key")
  ) {
    return {
      category: "ai",
      message: "AI 服务暂时不可用",
      suggestion: "可能是 AI 接口配额已满或网络不稳定，请稍后再试。如果问题持续，请检查 AI 服务配置。"
    };
  }

  if (
    lowerMessage.includes("超时") ||
    lowerMessage.includes("timeout") ||
    lowerMessage.includes("timed out")
  ) {
    return {
      category: "network",
      message: "请求超时",
      suggestion: "AI 生成或文件解析耗时过长，请稍后重试。如果频繁出现，可能是服务负载较高。"
    };
  }

  if (
    lowerMessage.includes("database") ||
    lowerMessage.includes("prisma") ||
    lowerMessage.includes("neon") ||
    lowerMessage.includes("sql") ||
    lowerMessage.includes("连接")
  ) {
    return {
      category: "database",
      message: "数据操作失败",
      suggestion: "数据库连接可能出现问题，请刷新页面后重试。如果问题持续，请稍后再试。"
    };
  }

  if (
    lowerMessage.includes("文件") ||
    lowerMessage.includes("上传") ||
    lowerMessage.includes("解析") ||
    lowerMessage.includes("ocr") ||
    lowerMessage.includes("识别") ||
    lowerMessage.includes("docx") ||
    lowerMessage.includes("pdf")
  ) {
    return {
      category: "file",
      message: "文件处理失败",
      suggestion: "请确认文件格式正确且未损坏。如果是扫描件或图片型 PDF，建议手动粘贴文本内容。"
    };
  }

  if (
    lowerMessage.includes("格式") ||
    lowerMessage.includes("不支持") ||
    lowerMessage.includes("invalid") ||
    lowerMessage.includes("validation")
  ) {
    return {
      category: "validation",
      message: "输入内容不符合要求",
      suggestion: "请检查输入内容是否完整且格式正确。"
    };
  }

  return {
    category: "unknown",
    message: "操作失败",
    suggestion: "请刷新页面后重试。如果问题持续，请稍后再试。"
  };
}

export function getErrorMessage(error: unknown): string {
  if (typeof error === "string") return error;
  if (error instanceof Error) return error.message;
  return "操作失败，请重试。";
}

export function getErrorSuggestion(error: unknown): string {
  const categorized = categorizeError(error);
  return categorized.suggestion;
}

export function getFullErrorDisplay(error: unknown): { title: string; message: string; suggestion: string } {
  const categorized = categorizeError(error);
  return {
    title: categorized.message,
    message: getErrorMessage(error),
    suggestion: categorized.suggestion
  };
}
