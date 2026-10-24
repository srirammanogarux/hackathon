# Pine Labs Online (Plural) payments spike

```bash
node --env-file=.env spikes/payments/create-order.mjs [trial|monthly]   # Rs 1 or Rs 299 hosted checkout, prints checkout_url
node --env-file=.env spikes/payments/order-status.mjs <order_id>
node --env-file=.env spikes/payments/callback-handler.mjs              # :8787 /pay/callback + /pay/webhook
node spikes/payments/callback-handler.mjs --selftest                   # signature code vs doc test vector
node --env-file=.env spikes/payments/create-payment-link.mjs [trial|monthly]
node --env-file=.env spikes/payments/create-payment-link.mjs get <payment_link_id>
```

Env: `PINELABS_CLIENT_ID` and `PINELABS_CLIENT_SECRET` are required. Optional:

- `PINELABS_BASE_URL` (defaults to UAT `https://pluraluat.v2.pinepg.in`)
- `APP_BASE_URL` (base for the callback URLs)
- `PINELABS_SECRET_KEY` (hex, signs the browser callback)
- `PINELABS_WEBHOOK_SECRET` (base64)

The last three are not in `.env.example` yet.

## Status (24 Oct, 15:10)

- **Verified:**
  - The UAT token endpoint is live. Dummy credentials get `401 "You are not authenticated..."`.
  - `/api/checkout/v1/orders`, `/api/pay/v1/orders`, `/api/pay/v1/paymentlink` and `/ps/api/v1/public/plans` all exist on UAT: they return 401 without a token, not 404.
  - The webhook HMAC code reproduces the docs' test vector (`--selftest`).
- **Not run:** a real order. There is no `.env` in the workspace, so no keys.

Docs are raw markdown: add `.md` to any page under `https://www.pinelabs.com/docs/online-payments/`. Index: `.../llms.txt`.

## Flow and exact fields

1. **Get a token.** `POST /api/auth/v1/token`
   - Body: `{client_id, client_secret, grant_type: "client_credentials"}`
   - Headers: `Request-ID` (uuid) and `Request-Timestamp` (ISO).
   - The response is `{access_token, expires_at}`; one guide shows `expires_in` instead, and the code handles both.
   - Later calls send `Authorization: Bearer <token>`.
2. **Create a hosted-checkout order.** `POST /api/checkout/v1/orders`. Use this one, not `/api/pay/v1/orders`, which is the custom-checkout Orders API and returns no redirect.
   - Body:
     - `merchant_order_reference` (this is also the idempotency key)
     - `order_amount: {value: <paise>, currency: "INR"}`
     - `allowed_payment_methods: ["UPI","CARD"]`
     - `integration_mode: "REDIRECT"`
     - `pre_auth: false`
     - `callback_url`, `failure_callback_url`
     - `purchase_details.customer: {email_id, first_name, last_name, mobile_number, country_code}`
   - Response: `{token, order_id, redirect_url, response_code, response_message}`. **`redirect_url` is the checkout URL.**
   - Amounts are in paise and the minimum is 100 (₹1). ₹299 is 29900.
3. **Callback.** The browser is sent back to `callback_url` with `{order_id, status, signature}` (plus `error_code`/`error_message` on failure). The docs don't say whether this is a GET or a form POST, so the handler accepts both.
   - Signature: take every field except `signature`, sort by key, and join as `k=v&k=v`.
   - HMAC-SHA256 that string with the **hex-decoded** `secret_key`, then hex-encode and uppercase it. Compare case-insensitively.
   - Then re-check `GET /api/pay/v1/orders/{order_id}` and treat `data.status == "PROCESSED"` as paid.
4. **Webhook.** Pine Labs uses Standard Webhooks.
   - Headers: `webhook-id`, `webhook-timestamp`, `webhook-signature: v1,<base64>`.
   - HMAC-SHA256 over `id.timestamp.rawBody`, keyed with the base64-decoded secret.
   - The body is `{event_type, data}`. Success is `ORDER_PROCESSED` (`ORDER_AUTHORIZED` if `pre_auth` is true). **There is no `ORDER_CAPTURED`**, which corrects our research note. Failure events: `ORDER_FAILED`, `PAYMENT_FAILED`, `ORDER_CANCELLED`.
   - Setup: get the webhook secret and URL under Dashboard > Settings > Webhook. One docs page says to email pgsupport@pinelabs.com to set the URL instead.
   - Pine Labs retries 3 times. Make the handler idempotent on `webhook-id`.
5. **Order status.** `GET /api/pay/v1/orders/{order_id}` returns `data.status`:
   - `CREATED`, `PENDING`, `ATTEMPTED`: not finished yet
   - `PROCESSED`: paid
   - `AUTHORIZED`: authorised but not captured (pre-auth orders)
   - `FAILED`, `CANCELLED`: not paid
   - refund statuses

## Fallback: Payment Links

- **No code:** create the link in the dashboard and share it.
- **API:** `POST /api/pay/v1/paymentlink` (returns 201).
  - Body: `{merchant_payment_link_reference, amount:{value,currency}, description, expire_by (ISO, ≤180 days), allowed_payment_methods, customer:{...}, callback_url}`.
  - Get the link with `GET /api/pay/v1/paymentlink/{payment_link_id}`. It returns `payment_link` (a short URL), `payment_link_id`, `order_id` and `status` (`CREATED`, `CLICKED`, `PAYMENT_INITIATED`, `PROCESSED`, `EXPIRED`, ...).
- The create response body is not documented. The script prints the whole body.
- The MID must be "configured for Pay by Link".

## Getting UAT keys (dev steps)

1. Sign up at `https://dashboardv2.pluralonline.com/signup` (name, email, phone, password), verify your email, then log in (2FA is required).
2. For UAT, use the staging dashboard `https://dashboardv2-staging.pluralonline.com/login`. Each environment has its own login and its own credentials.
3. Open **Settings > Credentials**. The quick start calls it "Settings > API Keys". Reveal or regenerate the **Client ID** and **Client Secret**. UAT needs no request to Pine Labs ("no production credentials required").
4. The callback `secret_key` (hex) is "provided by the Onboarding team". Ask the Pine Labs folks at the venue. The webhook secret is under Settings > Webhook.
5. Production keys come after UAT sign-off. You also have to email callback and webhook URLs to pgintegration@pinelabs.com so they can whitelist them.

## Test data (UAT)

- Cards: VISA `4012 0010 3714 1112` CVV `065`, Mastercard `5200 0000 0000 1096` CVV `123`, any future expiry. RuPay doesn't work in UAT.
- **UPI on UAT moves real money.** There are no test VPAs, and the amount decides the outcome: 100–50000 succeeds; 50100–60000 is pending; 60100–70000 fails. The table says INR, but the values look like paise. Test with ₹1.

## Subscriptions / UPI AutoPay (₹1 trial, then ₹299/month)

- **Needs enablement:** "Contact your account manager to enable subscriptions on your merchant account." **UPI only** (Intent or Collect).
- **API calls:**
  1. `POST /api/v1/customer` returns `cust-v1-...`
  2. `POST /ps/api/v1/public/plans` with `{plan_name, frequency: "Month", amount, max_limit_amount, end_date, merchant_plan_reference, trial_period_in_days?, initial_debit_amount?}`
  3. `POST /ps/api/v1/public/subscriptions` with `{merchant_subscription_reference, plan_id, start_date, end_date, customer_id, integration_mode: "REDIRECT"}` returns a `redirect_url`
- **Path warning:** the guide's cURL leaves out `/ps` and gets a 404 on UAT. Use the API-reference path.
- **Trial and mandate:** `trial_period_in_days` gives a free trial. Registration with ₹0 charges ₹2 and refunds it. For a ₹1 trial, try `initial_debit_amount: 100`; that's unverified.
- **Webhooks:** `SUBSCRIPTION_ACTIVATED`, `SUBSCRIPTION_CHARGED`, `SUBSCRIPTION_HALTED`, `SUBSCRIPTION_CANCELLED`.
- **Demo plan:** charge ₹1 through hosted checkout today. Show ₹299 as a second checkout or payment link, with the line "we remind you 2 days before charging". Switch to AutoPay once Pine Labs enables subscriptions.

## Unverified
- Prod base URL: the docs give both `https://api.pluralpay.in` (most examples) and `https://api.pluralonline.com` (settings page).
- Whether the callback arrives as a GET or a POST.
- Whether `failure_callback_url` is accepted on create (it isn't in the API-ref schema).
- Where to find the MID (not needed for these calls).
