import { NextResponse } from "next/server";
import { z } from "zod";
import { generateSandboxReply } from "@/lib/ai-config";

export const runtime = "nodejs";

const requestSchema = z.object({
  prompt: z.string().trim().min(1, "请输入一段测试问题后再提交。")
});

function getErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  return "AI 沙盒调用失败，请稍后再试。";
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { prompt } = requestSchema.parse(body);
    const result = await generateSandboxReply(prompt);

    return NextResponse.json({
      text: result.text,
      model: result.model
    });
  } catch (error) {
    console.error("AI Sandbox Error:", error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          error: error.issues[0]?.message ?? "请求参数不合法。"
        },
        { status: 400 }
      );
    }

    return NextResponse.json(
      {
        error: getErrorMessage(error),
        details: error instanceof Error ? error.stack : String(error)
      },
      { status: 500 }
    );
  }
}
