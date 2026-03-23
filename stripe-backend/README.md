# Stripe Backend (Render)

This service handles monthly commitment checkout and auto-cancels at cycle limit.

## Plans handled here
- `three_month_monthly` -> $249/mo, cancels after 3 paid cycles
- `twelve_month_monthly` -> $199/mo, cancels after 12 paid cycles

Upfront plans stay as direct Stripe Payment Links in the website frontend.

## Local run
1. Copy `.env.example` to `.env`
2. Set live/test Stripe keys
3. Run `npm install`
4. Run `npm start`

## Webhook
Set endpoint in Stripe Dashboard:
- `https://<your-render-service>/api/webhook`

Required events:
- `invoice.payment_succeeded`
- `checkout.session.completed`

## Frontend wiring
Set this in website HTML before checkout logic:

```html
<script>
  window.APEX_SUBSCRIPTION_API_BASE = "https://<your-render-service>";
</script>
```
