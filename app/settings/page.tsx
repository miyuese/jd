import type { Metadata } from "next";
import { getAiSettingsViewState } from "@/app/settings/actions";
import { SettingsWorkspace } from "@/components/settings-workspace";

export const metadata: Metadata = {
  title: "模型设置"
};

export default async function SettingsPage() {
  const state = await getAiSettingsViewState();

  return (
    <SettingsWorkspace
      configured={state.configured}
      isOwner={state.isOwner}
      initialProviderName={state.providerName}
      initialBaseURL={state.baseURL}
      initialApiKeyMasked={state.apiKeyMasked}
      initialPrimaryModel={state.primaryModel}
      initialFallbackModels={state.fallbackModels}
      envModel={state.envModel}
      envBaseURL={state.envBaseURL}
      envConfigured={state.envConfigured}
    />
  );
}
