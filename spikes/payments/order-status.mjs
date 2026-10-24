// GET /api/pay/v1/orders/{order_id}. Source of truth after a callback/webhook.
//   node --env-file=.env spikes/payments/order-status.mjs <order_id>
// data.status: CREATED | PENDING | PROCESSED | AUTHORIZED | CANCELLED | ATTEMPTED | FAILED | FULLY_REFUNDED | PARTIALLY_REFUNDED
import { getOrder, requireEnv } from './plural.mjs';

requireEnv('PINELABS_CLIENT_ID', 'PINELABS_CLIENT_SECRET');
const orderId = process.argv[2];
if (!orderId) throw new Error('usage: order-status.mjs <order_id>');
const res = await getOrder(orderId);
const d = res.data ?? res;
console.log(JSON.stringify({ order_id: d.order_id, status: d.status, amount: d.order_amount, ref: d.merchant_order_reference, payments: (d.payments ?? []).map((p) => ({ id: p.id, status: p.status, method: p.payment_method })) }, null, 2));
