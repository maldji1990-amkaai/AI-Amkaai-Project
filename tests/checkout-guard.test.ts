import assert from "node:assert/strict";
import test from "node:test";
import { isActiveSubscriptionStatus } from "../lib/subscription-guards";

test("checkout must regard APPROVAL_PENDING as a blocking subscription state", () => {
  const blockingStates = ["active", "activated", "APPROVAL_PENDING"];
  for (const state of blockingStates) assert.equal(isActiveSubscriptionStatus(state), true);
});
