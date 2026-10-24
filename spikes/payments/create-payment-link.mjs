// Fallback: Payment Links API. POST /api/pay/v1/paymentlink -> share `payment_link` URL (SMS/WhatsApp).
// Requires the MID to be "configured for Pay by Link". Zero-code alternative: create the link in the dashboard.
//   node --env-file=.env spikes/payments/create-payment-link.mjs [trial|monthly]
//   node --env-file=.env spikes/payments/create-payment-link.mjs get <payment_link_id>
import { api, requireEnv, PLANS } from './plural.mjs';

requireEnv('PINELABS_CLIENT_ID', 'PINELABS_CLIENT_SECRET');

if (process.argv[2] === 'get') {
  // status: CREATED | CLICKED | PAYMENT_INITIATED | PROCESSED | PARTIAL_PROCESSED | EXPIRED | CANCELLED
  const res = await api('GET', `/api/pay/v1/paymentlink/${encodeURIComponent(process.argv[3])}`);
  console.log(JSON.stringify(res, null, 2));
  process.exit(0);
}

const planKey = process.argv[2] ?? 'trial';
const plan = PLANS[planKey];
const appBase = process.env.APP_BASE_URL || 'http://localhost:8787';
const body = {
  merchant_payment_link_reference: `stanley-link-${planKey}-${Date.now()}`, // idempotency key
  amount: { value: plan.paise, currency: 'INR' },
  description: `Stanley ${plan.label}`,
  expire_by: new Date(Date.now() + 7 * 864e5).toISOString(), // <= 180 days
  allowed_payment_methods: ['UPI', 'CARD'],
  callback_url: `${appBase}/pay/callback`,
  customer: {
    email_id: process.env.TEST_CUSTOMER_EMAIL || 'test@example.com',
    first_name: 'Test',
    last_name: 'Creator',
    mobile_number: process.env.TEST_CUSTOMER_MOBILE || '9999999999',
    country_code: '91',
  },
};
const res = await api('POST', '/api/pay/v1/paymentlink', body);
console.log(JSON.stringify(res, null, 2)); // create response body is undocumented; Get returns payment_link, payment_link_id, status
console.log(`\npayment_link: ${res.payment_link ?? res.data?.payment_link ?? '(see body)'}`);
