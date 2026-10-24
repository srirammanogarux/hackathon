// Minimal callback + webhook handler (node:http, no deps). Drop these routes into the real backend.
//   node --env-file=.env spikes/payments/callback-handler.mjs          # listens on :8787
//   node spikes/payments/callback-handler.mjs --selftest               # checks signature code against the doc test vector
// Env: PINELABS_SECRET_KEY (hex, from onboarding/dashboard; signs the browser callback),
//      PINELABS_WEBHOOK_SECRET (base64, Dashboard > Settings > Webhook), plus client id/secret for the status re-check.
import http from 'node:http';
import { verifyCallback, verifyWebhook, signWebhook, signCallback, getOrder } from './plural.mjs';

if (process.argv.includes('--selftest')) {
  // Test vector from developer-tools-webhooks docs.
  const sig = signWebhook({ id: 'msg_2nEfCaUDn9fynC9Kz2upo1QSydl', timestamp: '1728543028', rawBody: '{"payload":"payload"}' }, 'YWJjMTIzNA==');
  console.log('webhook vector', sig === 'Ns46HrH+Nfu9dZtBUVvSLyrOD5JH0SAGlNo3M5yobfQ=' ? 'OK' : `MISMATCH ${sig}`);
  const p = { order_id: 'v1-x', status: 'PROCESSED' };
  const key = 'a1b2c3d4';
  console.log('callback roundtrip', verifyCallback({ ...p, signature: signCallback(p, key) }, key) ? 'OK' : 'FAIL');
  process.exit(0);
}

const PORT = Number(process.env.PORT || 8787);
const readBody = (req) => new Promise((ok) => { let b = ''; req.on('data', (c) => (b += c)); req.on('end', () => ok(b)); });

http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);

  // 1) Browser redirect after checkout. Method (GET query vs form POST) not stated in docs: accept both.
  if (url.pathname === '/pay/callback') {
    const raw = req.method === 'POST' ? await readBody(req) : '';
    const params = (req.headers['content-type'] ?? '').includes('json')
      ? JSON.parse(raw || '{}')
      : Object.fromEntries(new URLSearchParams(raw || url.search));
    const sigOk = verifyCallback(params, process.env.PINELABS_SECRET_KEY);
    // Never trust the redirect alone: re-check with the API before unlocking the plan.
    let status = params.status;
    try { status = (await getOrder(params.order_id)).data?.status ?? status; } catch (e) { console.error(e.message); }
    console.log('callback', { ...params, sigOk, apiStatus: status });
    const paid = status === 'PROCESSED';
    res.writeHead(302, { Location: paid ? '/welcome?paid=1' : `/pay/failed?order=${params.order_id}` });
    return res.end();
  }

  // 2) Server-to-server webhook (Standard Webhooks). Idempotent on webhook-id.
  if (url.pathname === '/pay/webhook' && req.method === 'POST') {
    const raw = await readBody(req);
    if (!verifyWebhook(req.headers, raw, process.env.PINELABS_WEBHOOK_SECRET)) {
      res.writeHead(401); return res.end('bad signature');
    }
    const evt = JSON.parse(raw); // {event_type, data: <order object>}
    switch (evt.event_type) {
      case 'ORDER_PROCESSED': // success when pre_auth=false (there is no ORDER_CAPTURED)
        console.log('PAID', evt.data?.order_id, evt.data?.merchant_order_reference); break;
      case 'ORDER_FAILED': case 'PAYMENT_FAILED': case 'ORDER_CANCELLED':
        console.log('NOT PAID', evt.event_type, evt.data?.order_id); break;
      case 'SUBSCRIPTION_ACTIVATED': case 'SUBSCRIPTION_CHARGED': case 'SUBSCRIPTION_HALTED': case 'SUBSCRIPTION_CANCELLED':
        console.log('SUB', evt.event_type, evt.data?.subscription_id); break;
      default: console.log('ignored', evt.event_type);
    }
    res.writeHead(200); return res.end('ok');
  }

  res.writeHead(404); res.end();
}).listen(PORT, () => console.log(`listening on :${PORT}  (/pay/callback, /pay/webhook)`));
