// Hosted Checkout: token -> POST /api/checkout/v1/orders -> print redirect_url (the checkout URL).
//   node --env-file=.env spikes/payments/create-order.mjs            # Rs 1 trial
//   node --env-file=.env spikes/payments/create-order.mjs monthly    # Rs 299
// Env: PINELABS_CLIENT_ID, PINELABS_CLIENT_SECRET, optional PINELABS_BASE_URL, APP_BASE_URL (for callbacks).
import { api, requireEnv, PLANS, BASE } from './plural.mjs';

requireEnv('PINELABS_CLIENT_ID', 'PINELABS_CLIENT_SECRET');

const planKey = process.argv[2] ?? 'trial';
const plan = PLANS[planKey];
if (!plan) throw new Error(`plan must be one of ${Object.keys(PLANS).join(', ')}`);

const appBase = process.env.APP_BASE_URL || 'http://localhost:8787';
const ref = `stanley-${planKey}-${Date.now()}`; // merchant_order_reference is also the idempotency key

const body = {
  merchant_order_reference: ref,
  order_amount: { value: plan.paise, currency: 'INR' }, // paise
  integration_mode: 'REDIRECT',
  pre_auth: false, // success webhook = ORDER_PROCESSED
  allowed_payment_methods: ['UPI', 'CARD'],
  notes: plan.label,
  callback_url: `${appBase}/pay/callback`,
  failure_callback_url: `${appBase}/pay/callback`, // used in the guide's examples; not in the API-ref schema
  purchase_details: {
    customer: {
      email_id: process.env.TEST_CUSTOMER_EMAIL || 'test@example.com',
      first_name: 'Test',
      last_name: 'Creator',
      mobile_number: process.env.TEST_CUSTOMER_MOBILE || '9999999999',
      country_code: '91',
    },
  },
};

console.log(`POST ${BASE}/api/checkout/v1/orders  (${plan.label}, ref ${ref})`);
const res = await api('POST', '/api/checkout/v1/orders', body);
// Documented response: {token, order_id, redirect_url, response_code, response_message}
console.log(JSON.stringify(res, null, 2));
console.log(`\ncheckout_url: ${res.redirect_url}`);
console.log(`order_id:     ${res.order_id}`);
console.log(`status:       node --env-file=.env spikes/payments/order-status.mjs ${res.order_id}`);
