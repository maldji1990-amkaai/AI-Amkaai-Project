-- Idempotency for credit reservations and webhook/job retries.
CREATE UNIQUE INDEX IF NOT EXISTS "Usage_referenceId_key" ON "Usage"("referenceId");
