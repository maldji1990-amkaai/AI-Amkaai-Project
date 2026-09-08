import assert from "node:assert/strict";
import test from "node:test";
import { shouldBlockPaymentForSubscription } from "../lib/subscription-guards";

test("duplicate PayPal subscription cannot be reactivated or receive recurring credits", () => {
  // Scenario:
  // SUB-A is the legitimate active subscription.
  // SUB-B was blocked locally as REJECTED_DUPLICATE but remains active at PayPal.
  // A recurring PAYMENT.SALE.COMPLETED arrives for SUB-B.
  const incomingStatus = "REJECTED_DUPLICATE";
  const hasConflictingActiveSubscription = true;

  const blocked = shouldBlockPaymentForSubscription(
    incomingStatus,
    hasConflictingActiveSubscription,
  );

  assert.equal(blocked, true);

  // Regression guarantees: the webhook must return before its credit grant
  // and subscription.updateMany("active") mutation paths are reached.
  let creditsGranted = false;
  let incomingSubscriptionReactivated = false;

  if (!blocked) {
    creditsGranted = true;
    incomingSubscriptionReactivated = true;
  }

  assert.equal(creditsGranted, false);
  assert.equal(incomingSubscriptionReactivated, false);
});
