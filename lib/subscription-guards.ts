export const ACTIVE_SUBSCRIPTION_STATUSES = [
  "active",
  "activated",
  "approval_pending",
] as const;

export function isActiveSubscriptionStatus(status: string | null | undefined): boolean {
  return ACTIVE_SUBSCRIPTION_STATUSES.includes(String(status ?? "").toLowerCase() as (typeof ACTIVE_SUBSCRIPTION_STATUSES)[number]);
}

export function isConflictingSubscription(
  existingPaypalSubscriptionId: string | null | undefined,
  incomingPaypalSubscriptionId: string | null | undefined,
): boolean {
  if (!existingPaypalSubscriptionId) return true;
  if (!incomingPaypalSubscriptionId) return true;
  return existingPaypalSubscriptionId !== incomingPaypalSubscriptionId;
}


/**
 * A recurring PayPal sale must never mutate billing state when the incoming
 * subscription was previously rejected as a duplicate, or when another
 * active/pending subscription exists for the same user.
 */
export function shouldBlockPaymentForSubscription(
  incomingStatus: string | null | undefined,
  hasConflictingActiveSubscription: boolean,
): boolean {
  if (String(incomingStatus ?? "").toUpperCase() === "REJECTED_DUPLICATE") {
    return true;
  }
  return hasConflictingActiveSubscription;
}
