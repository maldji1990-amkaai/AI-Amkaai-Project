ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "paypalCustomerId" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "paypalSubscriptionId" TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS "User_paypalSubscriptionId_key" ON "User"("paypalSubscriptionId");
ALTER TABLE "VideoJob" ADD COLUMN IF NOT EXISTS "generationId" TEXT;

CREATE TABLE IF NOT EXISTS "Project" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "status" TEXT NOT NULL DEFAULT 'DRAFT',
  "aspectRatio" TEXT NOT NULL DEFAULT '16:9',
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Project_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "Project_userId_updatedAt_idx" ON "Project"("userId", "updatedAt");

CREATE TABLE IF NOT EXISTS "Scene" (
  "id" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "index" INTEGER NOT NULL,
  "title" TEXT NOT NULL,
  "prompt" TEXT NOT NULL,
  "duration" INTEGER NOT NULL DEFAULT 5,
  "status" "JobStatus" NOT NULL DEFAULT 'PENDING',
  "videoUrl" TEXT,
  "imageUrl" TEXT,
  "audioUrl" TEXT,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Scene_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "Scene_projectId_index_key" ON "Scene"("projectId", "index");
CREATE INDEX IF NOT EXISTS "Scene_projectId_index_idx" ON "Scene"("projectId", "index");

CREATE TABLE IF NOT EXISTS "Character" (
  "id" TEXT NOT NULL, "userId" TEXT NOT NULL, "name" TEXT NOT NULL, "description" TEXT, "imageUrl" TEXT, "style" TEXT, "referenceId" TEXT, "metadata" JSONB, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Character_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "Character_userId_updatedAt_idx" ON "Character"("userId", "updatedAt");

CREATE TABLE IF NOT EXISTS "VoiceProfile" (
  "id" TEXT NOT NULL, "userId" TEXT NOT NULL, "name" TEXT NOT NULL, "description" TEXT, "language" TEXT, "audioUrl" TEXT, "provider" TEXT, "providerId" TEXT, "metadata" JSONB, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "VoiceProfile_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "VoiceProfile_userId_updatedAt_idx" ON "VoiceProfile"("userId", "updatedAt");

CREATE TABLE IF NOT EXISTS "Asset" (
  "id" TEXT NOT NULL, "userId" TEXT NOT NULL, "projectId" TEXT, "sceneId" TEXT, "name" TEXT NOT NULL, "type" TEXT NOT NULL, "url" TEXT NOT NULL, "mimeType" TEXT, "size" INTEGER, "duration" INTEGER, "metadata" JSONB, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Asset_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "Asset_userId_createdAt_idx" ON "Asset"("userId", "createdAt");
CREATE INDEX IF NOT EXISTS "Asset_projectId_createdAt_idx" ON "Asset"("projectId", "createdAt");

CREATE TABLE IF NOT EXISTS "Generation" (
  "id" TEXT NOT NULL, "userId" TEXT NOT NULL, "projectId" TEXT, "type" TEXT NOT NULL, "prompt" TEXT, "status" "JobStatus" NOT NULL DEFAULT 'PENDING', "error" TEXT, "metadata" JSONB, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Generation_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "Generation_userId_createdAt_idx" ON "Generation"("userId", "createdAt");
CREATE INDEX IF NOT EXISTS "Generation_projectId_createdAt_idx" ON "Generation"("projectId", "createdAt");

CREATE TABLE IF NOT EXISTS "GenerationStep" (
  "id" TEXT NOT NULL, "generationId" TEXT NOT NULL, "name" TEXT NOT NULL, "status" "JobStatus" NOT NULL DEFAULT 'PENDING', "progress" INTEGER NOT NULL DEFAULT 0, "input" JSONB, "output" JSONB, "error" TEXT, "startedAt" TIMESTAMP(3), "finishedAt" TIMESTAMP(3), "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "GenerationStep_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "GenerationStep_generationId_createdAt_idx" ON "GenerationStep"("generationId", "createdAt");

CREATE TABLE IF NOT EXISTS "Template" (
  "id" TEXT NOT NULL, "userId" TEXT, "name" TEXT NOT NULL, "category" TEXT NOT NULL, "prompt" TEXT NOT NULL, "sceneCount" INTEGER NOT NULL DEFAULT 6, "metadata" JSONB, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Template_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "Template_category_idx" ON "Template"("category");
CREATE INDEX IF NOT EXISTS "Template_userId_idx" ON "Template"("userId");

ALTER TABLE "Project" ADD CONSTRAINT "Project_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Scene" ADD CONSTRAINT "Scene_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Character" ADD CONSTRAINT "Character_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "VoiceProfile" ADD CONSTRAINT "VoiceProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Asset" ADD CONSTRAINT "Asset_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Asset" ADD CONSTRAINT "Asset_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Asset" ADD CONSTRAINT "Asset_sceneId_fkey" FOREIGN KEY ("sceneId") REFERENCES "Scene"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Generation" ADD CONSTRAINT "Generation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Generation" ADD CONSTRAINT "Generation_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "GenerationStep" ADD CONSTRAINT "GenerationStep_generationId_fkey" FOREIGN KEY ("generationId") REFERENCES "Generation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Template" ADD CONSTRAINT "Template_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "VideoJob" ADD CONSTRAINT "VideoJob_generationId_fkey" FOREIGN KEY ("generationId") REFERENCES "Generation"("id") ON DELETE SET NULL ON UPDATE CASCADE;
