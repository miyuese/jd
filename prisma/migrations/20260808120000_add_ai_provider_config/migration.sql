-- CreateTable
CREATE TABLE "JdAiProviderConfig" (
    "id" TEXT NOT NULL,
    "ownerUserId" TEXT NOT NULL,
    "providerName" TEXT NOT NULL DEFAULT 'openai-compatible',
    "baseURL" TEXT NOT NULL,
    "apiKey" TEXT NOT NULL,
    "primaryModel" TEXT NOT NULL,
    "fallbackModels" JSONB,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "JdAiProviderConfig_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "JdAiProviderConfig_ownerUserId_key" ON "JdAiProviderConfig"("ownerUserId");
