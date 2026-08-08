"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireClerkUserId } from "@/lib/auth-scope";
import {
  deleteAiProviderConfig,
  getActiveAiProviderConfig,
  getAiProviderConfigByOwner,
  upsertAiProviderConfig
} from "@/lib/ai-config-data";
import { testModelConnection } from "@/lib/ai-config";
import { exportAllUserData } from "@/lib/export-data";

type ActionResult =
  | {
      success: true;
      message: string;
      data?: unknown;
    }
  | {
      success: false;
      message: string;
    };

function maskApiKey(value: string) {
  if (value.length <= 8) {
    return `${value.slice(0, 2)}****`;
  }

  return `${value.slice(0, 3)}****${value.slice(-4)}`;
}

// ========== 保存 AI 模型配置 ==========

const saveSchema = z.object({
  providerName: z.string().trim().max(50).optional(),
  baseURL: z.string().trim().min(1, "接口地址（baseURL）不能为空。"),
  apiKey: z.string().trim().optional(), // 留空表示保留已保存的 key
  primaryModel: z.string().trim().min(1, "主模型不能为空。"),
  fallbackModels: z.string().trim().optional() // 逗号分隔的备用模型
});

export async function saveAiConfigAction(input: {
  providerName?: string;
  baseURL: string;
  apiKey?: string;
  primaryModel: string;
  fallbackModels?: string;
}): Promise<ActionResult> {
  const parsed = saveSchema.safeParse(input);

  if (!parsed.success) {
    return {
      success: false,
      message: parsed.error.issues[0]?.message ?? "配置保存失败，请检查输入后再试。"
    };
  }

  const userId = requireClerkUserId();

  try {
    // 权限校验：若存在由其他账号管理的生效配置，当前用户不可覆盖
    const active = await getActiveAiProviderConfig();

    if (active && active.ownerUserId !== userId) {
      return {
        success: false,
        message: "当前 AI 配置由其他账号管理，只有该账号可以修改。如需接管，请先删除现有配置。"
      };
    }

    const existing = await getAiProviderConfigByOwner(userId);

    // apiKey 留空时保留原 key；既无原 key 也未填写则报错
    let finalApiKey = parsed.data.apiKey;

    if (!finalApiKey) {
      finalApiKey = existing?.apiKey ?? "";
    }

    if (!finalApiKey) {
      return {
        success: false,
        message: "首次配置必须填写 API Key；后续修改可以留空以保留原 Key。"
      };
    }

    const fallbackModels = (parsed.data.fallbackModels ?? "")
      .split(/[,，]/)
      .map((item) => item.trim())
      .filter(Boolean);

    const config = await upsertAiProviderConfig({
      ownerUserId: userId,
      providerName: parsed.data.providerName || "openai-compatible",
      baseURL: parsed.data.baseURL,
      apiKey: finalApiKey,
      primaryModel: parsed.data.primaryModel,
      fallbackModels
    });

    revalidatePath("/settings");

    return {
      success: true,
      message: `AI 模型配置已保存并立即生效：主模型 ${config.primaryModel}${config.fallbackModels?.length ? `，备用 ${config.fallbackModels.join("、")}` : ""}。`,
      data: {
        primaryModel: config.primaryModel,
        fallbackModels: config.fallbackModels ?? []
      }
    };
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : "配置保存失败，请稍后再试。"
    };
  }
}

// ========== 重置为环境变量配置 ==========

export async function resetAiConfigAction(): Promise<ActionResult> {
  const userId = requireClerkUserId();

  try {
    const existing = await getAiProviderConfigByOwner(userId);

    if (!existing) {
      return {
        success: true,
        message: "当前没有自定义配置，系统正在使用环境变量配置。"
      };
    }

    await deleteAiProviderConfig(userId);
    revalidatePath("/settings");

    return {
      success: true,
      message: "已删除自定义配置，系统恢复为使用环境变量（AI_MODEL / AI_API_BASE_URL / AI_API_KEY）配置。"
    };
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : "重置配置失败，请稍后再试。"
    };
  }
}

// ========== 测试连接 ==========

const testSchema = z.object({
  providerName: z.string().trim().optional(),
  baseURL: z.string().trim().min(1, "接口地址不能为空。"),
  apiKey: z.string().trim().optional(), // 留空时使用已保存的 key 测试
  model: z.string().trim().min(1, "模型名不能为空。")
});

export async function testAiConnectionAction(input: {
  providerName?: string;
  baseURL: string;
  apiKey?: string;
  model: string;
}): Promise<ActionResult> {
  const parsed = testSchema.safeParse(input);

  if (!parsed.success) {
    return {
      success: false,
      message: parsed.error.issues[0]?.message ?? "参数不完整，无法测试连接。"
    };
  }

  try {
    let apiKey = parsed.data.apiKey;

    // 未填写 key 时，尝试使用已保存的配置 key
    if (!apiKey) {
      const active = await getActiveAiProviderConfig();
      apiKey = active?.apiKey ?? "";
    }

    if (!apiKey) {
      return {
        success: false,
        message: "请填写 API Key 后再测试（或先保存配置，测试时留空 key 即可）。"
      };
    }

    const result = await testModelConnection({
      providerName: parsed.data.providerName,
      baseURL: parsed.data.baseURL,
      apiKey,
      model: parsed.data.model
    });

    if (result.ok) {
      return {
        success: true,
        message: `连接成功：模型 ${parsed.data.model} 正常响应${result.text ? `（返回：${result.text}）` : ""}。`,
        data: { ok: true }
      };
    }

    return {
      success: false,
      message: `连接失败：${result.error ?? "未知错误"}`
    };
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : "连接测试失败，请稍后再试。"
    };
  }
}

// ========== 数据导出 / 备份 ==========

export async function exportAllDataAction(): Promise<ActionResult> {
  const userId = requireClerkUserId();

  try {
    const data = await exportAllUserData(userId);

    return {
      success: true,
      message: "全部数据已导出，浏览器将下载 JSON 备份文件。",
      data
    };
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : "数据导出失败，请稍后再试。"
    };
  }
}

// ========== 供页面读取（masked） ==========

export type AiSettingsViewState = {
  configured: boolean;
  isOwner: boolean;
  providerName: string;
  baseURL: string;
  apiKeyMasked: string;
  primaryModel: string;
  fallbackModels: string[];
  envModel: string;
  envBaseURL: string;
  envConfigured: boolean;
};

export async function getAiSettingsViewState(): Promise<AiSettingsViewState> {
  const userId = requireClerkUserId();
  const active = await getActiveAiProviderConfig();

  return {
    configured: Boolean(active),
    isOwner: active ? active.ownerUserId === userId : true,
    providerName: active?.providerName ?? "openai-compatible",
    baseURL: active?.baseURL ?? process.env.AI_API_BASE_URL ?? "",
    apiKeyMasked: active?.apiKey ? maskApiKey(active.apiKey) : "",
    primaryModel: active?.primaryModel ?? process.env.AI_MODEL ?? "",
    fallbackModels: active?.fallbackModels ?? [],
    envModel: process.env.AI_MODEL ?? "",
    envBaseURL: process.env.AI_API_BASE_URL ?? "",
    envConfigured: Boolean(process.env.AI_API_BASE_URL && process.env.AI_API_KEY && process.env.AI_MODEL)
  };
}
