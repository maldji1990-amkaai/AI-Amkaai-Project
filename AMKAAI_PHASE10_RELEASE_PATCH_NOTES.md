# AmkaAI Phase 10 — Release Patch Notes

This patch is applied to the supplied Phase 10 candidate. `node_modules`, `.next`, and real environment files are intentionally excluded.

## Fixes applied

1. **Free-credit abuse / duplicate user-provisioning path**
   - `lib/getUser.ts` no longer grants 30 credits during authenticated user creation.
   - New users are created with `TRIAL`, `credits=0`, and no trial dates.
   - The PayPal subscription webhook remains the authority that starts the 3-day trial and grants trial credits.

2. **Manual/local payment amount tampering**
   - `/api/manual-payment` and `/api/upload-payment` no longer accept a client-controlled amount.
   - USD/USDT amounts come from the canonical server catalog.
   - DZD manual amounts come only from server environment variables:
     - `MANUAL_PRICE_DZD_MONTHLY`
     - `MANUAL_PRICE_DZD_QUARTERLY`
     - `MANUAL_PRICE_DZD_BIANNUALLY`
   - DZD manual payments return a controlled configuration error until those values are configured.

3. **PayPal recurring payment amount verification**
   - `PAYMENT.SALE.COMPLETED` now checks the received amount against the canonical server price before changing plan/credits.
   - Zero-value trial sales are ignored instead of granting paid monthly credits.
   - Non-USD recurring PayPal sales are rejected.

4. **Business placeholder protection**
   - Direct checkout cannot purchase the unfinished Business plan.
   - The PayPal webhook also rejects Business events, preventing a `$0` placeholder from becoming a live entitlement through an API/webhook path.

5. **Hardcoded manual-payment account data removed from legacy UI code**
   - The unused `components/ManualPaymentBox.tsx` containing hardcoded payment details was removed.
   - Payment addresses remain server-configured through `/api/payment-info`.

6. **Pricing UI no longer displays fake `0 DZD` for paid plans**
   - DZD values are read from `/api/payment-info`.
   - If not configured, the UI displays `Not configured yet` instead of `0 DZD`.

## Required production environment values before enabling Algerian manual payments

Set these on the server (Vercel/production environment), not in client code:

- `MANUAL_PRICE_DZD_MONTHLY`
- `MANUAL_PRICE_DZD_QUARTERLY`
- `MANUAL_PRICE_DZD_BIANNUALLY`

Use the exact commercial prices you decide to publish.

## Important test status

A complete `npm run build` / TypeScript validation was **not possible in this environment** because the supplied project intentionally omitted dependencies and the dependency installation timed out. Do not treat the project as Build-PASS yet.

Before public marketing, run:

1. `npm ci`
2. `npm run typecheck`
3. `npm run build`
4. `npx prisma migrate deploy`
5. PayPal sandbox trial activation test
6. PayPal recurring payment test
7. Duplicate webhook replay test
8. Trial expiry test
9. Insufficient-credit test
10. Generation failure/refund test
11. Manual-payment approval/refusal test
12. Refund/revocation test
13. Production smoke test with real environment variables

Do not put real API keys, PayPal secrets, webhook secrets, database URLs, or payment account credentials into the ZIP.

## 2026-09-05 — PayPal recurring-payment duplicate protection

- Added a second webhook-level guard for `PAYMENT.SALE.COMPLETED`.
- A local `REJECTED_DUPLICATE` subscription can no longer be reactivated by a later recurring PayPal sale.
- Recurring sales are blocked when another active/activated/approval_pending subscription exists for the same user.
- Blocked payment events are recorded in `WebhookEvent` and do not grant credits or update subscription/user billing state.
- Added regression tests for the duplicate-subscription recurring-payment scenario.
