-- Billing/Credits hardening. This migration also reconciles the legacy PlanType enum.
-- Legacy mapping: FREE -> TRIAL, PRO -> MONTHLY, PREMIUM -> BUSINESS.

ALTER TYPE "PlanType" RENAME TO "PlanType_legacy";
CREATE TYPE "PlanType" AS ENUM ('TRIAL', 'MONTHLY', 'QUARTERLY', 'BIANNUALLY', 'BUSINESS');

ALTER TABLE "User" ALTER COLUMN "plan" DROP DEFAULT;
ALTER TABLE "User"
  ALTER COLUMN "plan" TYPE "PlanType"
  USING (
    CASE "plan"::text
      WHEN 'FREE' THEN 'TRIAL'::"PlanType"
      WHEN 'PRO' THEN 'MONTHLY'::"PlanType"
      WHEN 'PREMIUM' THEN 'BUSINESS'::"PlanType"
      ELSE 'TRIAL'::"PlanType"
    END
  );
ALTER TABLE "User" ALTER COLUMN "plan" SET DEFAULT 'TRIAL';

ALTER TABLE "Subscription" ALTER COLUMN "plan" DROP DEFAULT;
ALTER TABLE "Subscription"
  ALTER COLUMN "plan" TYPE "PlanType"
  USING (
    CASE "plan"::text
      WHEN 'FREE' THEN 'TRIAL'::"PlanType"
      WHEN 'PRO' THEN 'MONTHLY'::"PlanType"
      WHEN 'PREMIUM' THEN 'BUSINESS'::"PlanType"
      ELSE 'TRIAL'::"PlanType"
    END
  );

DROP TYPE "PlanType_legacy";

ALTER TABLE "Subscription" ADD COLUMN IF NOT EXISTS "cancelAtPeriodEnd" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Payment" ADD COLUMN IF NOT EXISTS "provider" TEXT NOT NULL DEFAULT 'paypal';
ALTER TABLE "Payment" ADD COLUMN IF NOT EXISTS "providerPaymentId" TEXT;
ALTER TABLE "Payment" ADD COLUMN IF NOT EXISTS "plan" "PlanType";
ALTER TABLE "ManualPayment" ADD COLUMN IF NOT EXISTS "expectedAmount" DOUBLE PRECISION;
ALTER TABLE "Payment" ALTER COLUMN "status" SET DEFAULT 'PENDING';
CREATE UNIQUE INDEX IF NOT EXISTS "Payment_providerPaymentId_key" ON "Payment"("providerPaymentId");
CREATE INDEX IF NOT EXISTS "Payment_provider_idx" ON "Payment"("provider");

CREATE TABLE IF NOT EXISTS "CreditTransaction" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "amount" INTEGER NOT NULL,
  "balanceAfter" INTEGER NOT NULL,
  "type" TEXT NOT NULL,
  "reference" TEXT NOT NULL,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CreditTransaction_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "CreditTransaction_reference_key" ON "CreditTransaction"("reference");
CREATE INDEX IF NOT EXISTS "CreditTransaction_userId_createdAt_idx" ON "CreditTransaction"("userId", "createdAt");
CREATE INDEX IF NOT EXISTS "CreditTransaction_type_createdAt_idx" ON "CreditTransaction"("type", "createdAt");
ALTER TABLE "CreditTransaction" ADD CONSTRAINT "CreditTransaction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
