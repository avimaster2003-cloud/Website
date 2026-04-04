const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const dotenv = require('dotenv');
const Stripe = require('stripe');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 10000;
const ADMIN_API_KEY = (process.env.ADMIN_API_KEY || '').trim();
const CONTRACT_WEBHOOK_URL = (process.env.CONTRACT_WEBHOOK_URL || '').trim();
const CONTRACT_WEBHOOK_SECRET = (process.env.CONTRACT_WEBHOOK_SECRET || '').trim();
const DATA_DIR = path.join(__dirname, 'data');
const EVENTS_FILE = path.join(DATA_DIR, 'events.jsonl');
const CONTRACTS_FILE = path.join(DATA_DIR, 'contracts.jsonl');
const CONTRACT_ARCHIVE_DIR = path.join(DATA_DIR, 'contract-archive');

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

if (!fs.existsSync(CONTRACT_ARCHIVE_DIR)) {
  fs.mkdirSync(CONTRACT_ARCHIVE_DIR, { recursive: true });
}

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

function appendJsonl(filePath, record) {
  fs.appendFileSync(filePath, `${JSON.stringify(record)}\n`, 'utf8');
}

function readLatestJsonl(filePath, limit = 100) {
  if (!fs.existsSync(filePath)) return [];
  const lines = fs.readFileSync(filePath, 'utf8').trim().split('\n').filter(Boolean);
  const sliced = lines.slice(-Math.max(1, Math.min(Number(limit) || 100, 1000)));
  return sliced.map((line) => {
    try {
      return JSON.parse(line);
    } catch {
      return { parseError: true, raw: line };
    }
  });
}

function requireAdminKey(req, res, next) {
  if (!ADMIN_API_KEY) return next();

  const supplied = (req.headers['x-admin-key'] || req.query.key || '').toString().trim();
  if (!supplied || supplied !== ADMIN_API_KEY) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  return next();
}

async function forwardContractPacket(record) {
  if (!CONTRACT_WEBHOOK_URL) {
    return {
      attempted: false,
      delivered: false,
      statusCode: null,
      responsePreview: 'No CONTRACT_WEBHOOK_URL configured'
    };
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    const resp = await fetch(CONTRACT_WEBHOOK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(CONTRACT_WEBHOOK_SECRET ? { 'x-contract-webhook-secret': CONTRACT_WEBHOOK_SECRET } : {})
      },
      body: JSON.stringify(record),
      signal: controller.signal
    });

    clearTimeout(timeout);
    const text = await resp.text();

    return {
      attempted: true,
      delivered: resp.ok,
      statusCode: resp.status,
      responsePreview: (text || '').slice(0, 300)
    };
  } catch (error) {
    return {
      attempted: true,
      delivered: false,
      statusCode: null,
      responsePreview: `Webhook error: ${error.message}`
    };
  }
}

function sha256(input) {
  return crypto.createHash('sha256').update(String(input || ''), 'utf8').digest('hex');
}

function writeContractArchiveText(record) {
  const safeSigner = String(record.signerName || 'unknown-signer').replace(/[^a-zA-Z0-9-_]+/g, '-').slice(0, 60);
  const filename = `${record.packetId}-${safeSigner}.txt`;
  const filePath = path.join(CONTRACT_ARCHIVE_DIR, filename);
  fs.writeFileSync(filePath, record.packetText, 'utf8');
  return { filePath, filename };
}

function trackEvent(name, payload = {}) {
  const record = {
    ts: new Date().toISOString(),
    name,
    payload
  };
  appendJsonl(EVENTS_FILE, record);
}



app.post('/api/event', (req, res) => {
  try {
    const { name, payload } = req.body || {};

    if (!name || typeof name !== 'string') {
      return res.status(400).json({ error: 'Event name is required' });
    }

    const record = {
      ts: new Date().toISOString(),
      name,
      payload: payload || {},
      ip: req.headers['cf-connecting-ip'] || req.ip,
      userAgent: req.headers['user-agent'] || ''
    };

    appendJsonl(EVENTS_FILE, record);
    return res.json({ ok: true });
  } catch (error) {
    console.error('event ingest error', error);
    return res.status(500).json({ error: 'Failed to ingest event' });
  }
});

app.get('/api/event', requireAdminKey, (req, res) => {
  try {
    const limit = Number(req.query.limit || 100);
    const events = readLatestJsonl(EVENTS_FILE, limit);
    return res.json({ count: events.length, events });
  } catch (error) {
    console.error('event fetch error', error);
    return res.status(500).json({ error: 'Failed to fetch events' });
  }
});

app.post('/api/contract-packet', async (req, res) => {
  try {
    const { packetText, signerEmail, signerName, legalName, dbaName, selectedPlan, source, legalTarget } = req.body || {};

    if (!packetText || !signerEmail) {
      return res.status(400).json({ error: 'packetText and signerEmail are required' });
    }

    const packetId = `VETRA-${Date.now()}-${Math.floor(Math.random() * 100000)}`;
    const packetSha256 = sha256(packetText);

    const recordBase = {
      packetId,
      ts: new Date().toISOString(),
      signerEmail,
      signerName: signerName || '',
      legalName: legalName || '',
      dbaName: dbaName || '',
      selectedPlan: selectedPlan || '',
      source: source || 'unknown',
      legalTarget: legalTarget || '',
      packetSha256,
      packetText,
      ip: req.headers['cf-connecting-ip'] || req.ip,
      userAgent: req.headers['user-agent'] || ''
    };

    const archive = writeContractArchiveText(recordBase);
    const delivery = await forwardContractPacket(recordBase);
    const record = {
      ...recordBase,
      archiveFilename: archive.filename,
      archivePath: archive.filePath,
      webhookAttempted: delivery.attempted,
      webhookDelivered: delivery.delivered,
      webhookStatusCode: delivery.statusCode,
      webhookResponsePreview: delivery.responsePreview
    };

    appendJsonl(CONTRACTS_FILE, record);
    return res.json({
      ok: true,
      packetId,
      packetSha256,
      archiveFilename: archive.filename,
      webhookDelivered: delivery.delivered,
      webhookStatusCode: delivery.statusCode
    });
  } catch (error) {
    console.error('contract packet ingest error', error);
    return res.status(500).json({ error: 'Failed to ingest contract packet' });
  }
});

app.get('/api/contract-packet', requireAdminKey, (req, res) => {
  try {
    const limit = Number(req.query.limit || 50);
    const packets = readLatestJsonl(CONTRACTS_FILE, limit);
    return res.json({ count: packets.length, packets });
  } catch (error) {
    console.error('contract packet fetch error', error);
    return res.status(500).json({ error: 'Failed to fetch contract packets' });
  }
});

app.post('/api/create-monthly-checkout-session', async (req, res) => {
  try {
    const { tier, email, shopName, bundleData } = req.body;
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
          max_cycles: String(plan.maxCycles),
          bundleMode: bundleData?.mode || 'software_only'
        }
      });
    } else {
      const customer = await stripe.customers.create({
        email,
        metadata: {
          shopName,
          tier,
          max_cycles: String(plan.maxCycles),
          bundleMode: bundleData?.mode || 'software_only'
        }
      });
      customerId = customer.id;
    }

    // Track this checkout session start event
    trackEvent('monthly_checkout_session_created', {
      tier,
      email,
      shopName,
      bundleMode: bundleData?.mode || 'software_only'
    });

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      customer: customerId,
      payment_method_types: ['us_bank_account', 'card'],
      line_items: [{ price: plan.priceId, quantity: 1 }],
      success_url: `${process.env.FRONTEND_URL || 'https://usevetra.com'}/#checkout?success=1`,
      cancel_url: `${process.env.FRONTEND_URL || 'https://usevetra.com'}/#checkout?canceled=1`,
      subscription_data: {
        metadata: {
          tier,
          max_cycles: String(plan.maxCycles),
          shopName,
          bundleMode: bundleData?.mode || 'software_only',
          bundleData: JSON.stringify(bundleData || {})
        }
      },
      metadata: {
        tier,
        shopName,
        max_cycles: String(plan.maxCycles),
        bundleMode: bundleData?.mode || 'software_only'
      }
    });

    return res.json({ url: session.url });
  } catch (error) {
    console.error('create-monthly-checkout-session error', error);
    return res.status(500).json({ error: error.message || 'Session creation failed' });
  }
});

app.post('/api/hardware-bundle-application', async (req, res) => {
  try {
    const { tier, email, shopName, bundleData, lead } = req.body;

    if (!email || !shopName || !bundleData) {
      return res.status(400).json({ error: 'Email, shopName, and bundleData are required' });
    }

    const bundleRecord = {
      ts: new Date().toISOString(),
      tier: tier || '',
      email,
      shopName,
      bundleMode: bundleData.mode || 'software_only',
      primaryHardware: bundleData.primary || 'none',
      secondaryHardware: bundleData.secondary || 'none',
      leaseTerm: bundleData.term || 60,
      estimatedLease: bundleData.estimatedLease || 0,
      aprAddOn: bundleData.aprAddOn || 0,
      leadName: (lead?.ownerName || '').trim(),
      leadEmail: (lead?.ownerEmail || '').trim(),
      leadPhone: (lead?.ownerPhone || '').trim(),
      acknowledgements: {
        personalGuarantee: Boolean(bundleData.acknowledgements?.personalGuarantee),
        insuranceBeneficiary: Boolean(bundleData.acknowledgements?.insuranceBeneficiary),
        achBilling: Boolean(bundleData.acknowledgements?.achBilling)
      },
      ip: req.headers['cf-connecting-ip'] || req.ip,
      userAgent: req.headers['user-agent'] || ''
    };

    appendJsonl(CONTRACTS_FILE, bundleRecord);

    // Track hardware bundle intake event
    trackEvent('hardware_bundle_application', {
      tier,
      email,
      shopName,
      primaryHardware: bundleData.primary,
      estimatedLease: bundleData.estimatedLease
    });

    return res.json({
      ok: true,
      bundleId: `BUNDLE-${Date.now()}`,
      message: 'Hardware bundle application recorded'
    });
  } catch (error) {
    console.error('hardware-bundle-application error', error);
    return res.status(500).json({ error: error.message || 'Failed to process hardware bundle application' });
  }
});

app.get('/api/hardware-applications', requireAdminKey, (req, res) => {
  try {
    const limit = Number(req.query.limit || 50);
    const records = readLatestJsonl(CONTRACTS_FILE, limit);
    const bundleApplications = records.filter(r => r.bundleMode && r.bundleMode !== 'software_only');
    return res.json({ 
      count: bundleApplications.length, 
      applications: bundleApplications,
      total: records.length
    });
  } catch (error) {
    console.error('hardware-applications fetch error', error);
    return res.status(500).json({ error: 'Failed to fetch hardware applications' });
  }
});

app.get('/api/checkout-analytics', requireAdminKey, (req, res) => {
  try {
    const limit = Number(req.query.limit || 500);
    const events = readLatestJsonl(EVENTS_FILE, limit);
    
    const analytics = {
      totalEvents: events.length,
      checkoutStarted: 0,
      checkoutCompleted: 0,
      contractSigned: 0,
      hardwareBundlesApplied: 0,
      conversionRate: 0,
      eventsByType: {}
    };

    events.forEach(event => {
      const name = event.name || 'unknown';
      analytics.eventsByType[name] = (analytics.eventsByType[name] || 0) + 1;
      
      if (name === 'monthly_checkout_session_created') {
        analytics.checkoutStarted += 1;
      } else if (name === 'checkout.session.completed') {
        analytics.checkoutCompleted += 1;
      } else if (name === 'contract_signed') {
        analytics.contractSigned += 1;
      } else if (name === 'hardware_bundle_application') {
        analytics.hardwareBundlesApplied += 1;
      }
    });

    if (analytics.checkoutStarted > 0) {
      analytics.conversionRate = ((analytics.checkoutCompleted / analytics.checkoutStarted) * 100).toFixed(1) + '%';
    }

    return res.json(analytics);
  } catch (error) {
    console.error('checkout-analytics error', error);
    return res.status(500).json({ error: 'Failed to fetch checkout analytics' });
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
