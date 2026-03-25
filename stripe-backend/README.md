# Stripe Backend (Render)

This service handles monthly commitment checkout and auto-cancels at cycle limit.

## Plans handled here
- `three_month_monthly` -> $249/mo, cancels after 3 paid cycles
- `twelve_month_monthly` -> $199/mo, cancels after 12 paid cycles

Upfront plans stay as direct Stripe Payment Links in the website frontend.

## Local run
1. Copy `.env.example` to `.env`
2. Set live/test Stripe keys
3. Set `CONTRACT_WEBHOOK_URL` to your automation webhook if you want contract packets auto-forwarded
4. Optionally set `CONTRACT_WEBHOOK_SECRET` and `ADMIN_API_KEY`
5. Run `npm install`
6. Run `npm start`

## Webhook
Set endpoint in Stripe Dashboard:
- `https://<your-render-service>/api/webhook`

Required events:
- `invoice.payment_succeeded`
- `checkout.session.completed`

## Contract automation webhook
Backend contract packet submissions can be forwarded to:
- `CONTRACT_WEBHOOK_URL`

Optional auth header sent by backend when configured:
- `x-contract-webhook-secret: <CONTRACT_WEBHOOK_SECRET>`

## Automated legal email delivery
Contract packets can also be automatically emailed by the backend on every `/api/contract-packet` call.

Set these env vars:
- `LEGAL_EMAIL_TO` (default: `legal@usevetra.com`)
- `LEGAL_EMAIL_CC` (optional comma-separated)
- `CONTRACT_EMAIL_FROM` (required for SMTP send)
- `SMTP_HOST`
- `SMTP_PORT` (default `587`)
- `SMTP_SECURE` (`true` or `false`)
- `SMTP_USER`
- `SMTP_PASS`

Each packet is also archived server-side under `data/contract-archive/` and indexed in `data/contracts.jsonl` with delivery statuses.

## Frontend wiring
Set this in website HTML before checkout logic:

```html
<script>
  window.APEX_SUBSCRIPTION_API_BASE = "https://<your-render-service>";
</script>
```
