import assert from "node:assert/strict";
import test from "node:test";
import {
  isActiveSubscriptionStatus,
  isConflictingSubscription,
  shouldBlockPaymentForSubscription,
} from "../lib/subscription-guards";

test("active and pending PayPal subscriptions are treated as active", () => {
  assert.equal(isActiveSubscriptionStatus("active"), true);
  assert.equal(isActiveSubscriptionStatus("ACTIVATED"), true);
  assert.equal(isActiveSubscriptionStatus("approval_pending"), true);
  assert.equal(isActiveSubscriptionStatus("cancelled"), false);
  assert.equal(isActiveSubscriptionStatus("expired"), false);
});

test("a different PayPal subscription ID conflicts", () => {
  assert.equal(isConflictingSubscription("SUB-A", "SUB-B"), true);
  assert.equal(isConflictingSubscription("SUB-A", "SUB-A"), false);
  assert.equal(isConflictingSubscription(null, "SUB-A"), true);
  assert.equal(isConflictingSubscription("SUB-A", null), true);
});


test("recurring payment is blocked for a rejected duplicate subscription", () => {
  assert.equal(
    shouldBlockPaymentForSubscription("REJECTED_DUPLICATE", false),
    true,
  );
});

test("recurring payment is blocked when another active subscription exists", () => {
  assert.equal(
    shouldBlockPaymentForSubscription("active", true),
    true,
  );
});

test("recurring payment is allowed for the user's own active subscription", () => {
  assert.equal(
    shouldBlockPaymentForSubscription("active", false),
    false,
  );
});
