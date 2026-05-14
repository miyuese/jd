import type { Metadata } from "next";
import { AiSandboxPanel } from "@/components/ai-sandbox-panel";
import { getAiConfigStatus } from "@/lib/ai-config";

export const metadata: Metadata = {
  title: "AI 沙盒"
};

export default function AiSandboxPage() {
  const config = getAiConfigStatus();

  return <AiSandboxPanel {...config} />;
}
