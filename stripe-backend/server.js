const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const dotenv = require('dotenv');
const Stripe = require('stripe');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 10000;

if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error('Missing STRIPE_SECRET_KEY');
}

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

const allowedOrigins = (process.env.FRONTEND_URLS || process.env.FRONTEND_URL || '')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);

function isAllowedOrigin(origin) {
  if (!origin) return true;
  if (allowedOrigins.length === 0) return true;
  return allowedOrigins.includes(origin);
}

app.use(cors({
  origin(origin, callback) {
    if (isAllowedOrigin(origin)) return callback(null, true);
    return callback(new Error(`CORS blocked origin: ${origin}`));
  }
}));

app.use('/api/webhook', bodyParser.raw({ type: 'application/json' }));
app.use(bodyParser.json());

const MONTHLY_PLANS = {
  three_month_monthly: {
    label: '3 Month Commitment',
    priceId: process.env.STRIPE_PRICE_ID_3M_MONTHLY,
    maxCycles: 3
  },
  twelve_month_monthly: {
    label: '12 Month Commitment',
    priceId: process.env.STRIPE_PRICE_ID_12M_MONTHLY,
    maxCycles: 12
  }
};

app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'apex-stripe-render-backend' });
});

app.post('/api/create-monthly-checkout-session', async (req, res) => {
  try {
    const { tier, email, shopName } = req.body;
    const plan = MONTHLY_PLANS[tier];

    if (!plan) {
      return res.status(400).json({ error: 'Invalid monthly plan tier' });
    }

    if (!plan.priceId) {
      return res.status(500).json({ error: `Missing price id for ${tier}` });
    }

    if (!email || !shopName) {
      return res.status(400).json({ error: 'Email and shop name are required' });
    }

    const customers = await stripe.customers.list({ email, limit: 1 });
    let customerId;

    if (customers.data.length > 0) {
      customerId = customers.data[0].id;
      await stripe.customers.update(customerId, {
        metadata: {
          shopName,
          tier,
          max_cycles: String(plan.maxCycles)
        }
      });
    } else {
      const customer = await stripe.customers.create({
        email,
        metadata: {
          shopName,
          tier,
          max_cycles: String(plan.maxCycles)
        }
      });
      customerId = customer.id;
    }

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      customer: customerId,
      payment_method_types: ['us_bank_account', 'card'],
      line_items: [{ price: plan.priceId, quantity: 1 }],
      success_url: `${process.env.FRONTEND_URL}/#checkout?success=1`,
      cancel_url: `${process.env.FRONTEND_URL}/#checkout?canceled=1`,
      subscription_data: {
        metadata: {
          tier,
          max_cycles: String(plan.maxCycles),
          shopName
        }
      },
      metadata: {
        tier,
        shopName,
        max_cycles: String(plan.maxCycles)
      }
    });

    return res.json({ url: session.url });
  } catch (error) {
    console.error('create-monthly-checkout-session error', error);
    return res.status(500).json({ error: error.message || 'Session creation failed' });
  }
});

app.post('/api/webhook', async (req, res) => {
  let event;

  try {
    event = stripe.webhooks.constructEvent(
      req.body,
      req.headers['stripe-signature'],
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    console.error('Webhook signature verification failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  try {
    if (event.type === 'invoice.payment_succeeded') {
      const invoice = event.data.object;
      if (invoice.subscription) {
        await enforceSubscriptionCycleLimit(invoice.subscription);
      }
    }

    if (event.type === 'checkout.session.completed') {
      const session = event.data.object;
      console.log('Checkout completed', {
        sessionId: session.id,
        customer: session.customer,
        tier: session.metadata?.tier
      });
    }

    res.json({ received: true });
  } catch (error) {
    console.error('Webhook processing error:', error);
    res.status(500).json({ error: error.message || 'Webhook processing failed' });
  }
});

async function enforceSubscriptionCycleLimit(subscriptionId) {
  const subscription = await stripe.subscriptions.retrieve(subscriptionId);
  const maxCycles = Number(subscription.metadata?.max_cycles || 0);

  if (!maxCycles || !Number.isFinite(maxCycles)) {
    return;
  }

  const invoices = await stripe.invoices.list({
    subscription: subscriptionId,
    limit: 100,
    status: 'paid'
  });

  const qualifyingInvoices = invoices.data.filter((inv) => {
    return inv.billing_reason === 'subscription_create' || inv.billing_reason === 'subscription_cycle';
  });

  const paidCycleCount = qualifyingInvoices.length;

  if (paidCycleCount >= maxCycles && !subscription.cancel_at_period_end) {
    await stripe.subscriptions.update(subscriptionId, { cancel_at_period_end: true });
    console.log('Set cancel_at_period_end', {
      subscriptionId,
      paidCycleCount,
      maxCycles
    });
  }
}

app.listen(PORT, () => {
  console.log(`Apex Stripe Render backend listening on port ${PORT}`);
});
