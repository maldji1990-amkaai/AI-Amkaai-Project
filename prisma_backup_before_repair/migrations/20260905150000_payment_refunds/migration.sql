ALTER TABLE "Payment" ADD COLUMN "refundedAmount" DOUBLE PRECISION;
ALTER TABLE "Payment" ADD COLUMN "refundId" TEXT;
ALTER TABLE "Payment" ADD COLUMN "refundStatus" TEXT;
ALTER TABLE "Payment" ADD COLUMN "refundedAt" TIMESTAMP(3);
ALTER TABLE "Payment" ADD COLUMN "refundReason" TEXT;
CREATE UNIQUE INDEX "Payment_refundId_key" ON "Payment"("refundId");
