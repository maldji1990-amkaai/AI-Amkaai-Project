-- Production queue hardening: external provider job id is required to correlate webhooks.
ALTER TABLE "VideoJob" ADD COLUMN IF NOT EXISTS "externalJobId" TEXT;
CREATE INDEX IF NOT EXISTS "VideoJob_externalJobId_idx" ON "VideoJob"("externalJobId");
