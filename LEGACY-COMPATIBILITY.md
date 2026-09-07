# AmkaAI legacy compatibility

The canonical application is the Next.js App Router application.

## Canonical billing
- Checkout: `/api/checkout` (PayPal)
- Manual payment: `/api/manual-payment`
- Crypto: `/api/crypto-checkout` + `/api/crypto-webhook`
- Subscription state: `/api/my-subscription` and `/api/billing`
- Credits: `/api/credits`

## Intentionally retained compatibility routes
- `/api/upgrade`: disabled (410).
- `/api/dev/upgrade`: disabled (410).
- `/api/upload-payment`: retained for old clients; it never activates an account and follows the same server-side pricing rules.
- `/api/abandoned`: retained for historical/admin reporting; checkout creation no longer records a checkout as abandoned.
- `/api/generate-image`: retained as the existing image-to-video compatibility endpoint; the UI labels the feature as Image to Video.

## Legacy backend
The `backend/` directory is a separate legacy Express application. It is not used by the Next.js App Router routes. It is retained in this release to avoid silently breaking an external deployment that may still reference it. It should not be used as the source of truth for billing, credits, subscriptions, authentication, or generation.

## RunPod
RunPod integration files are intentionally preserved unchanged.
