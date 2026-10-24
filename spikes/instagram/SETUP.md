# Instagram setup: get `IG_USER_ID` and a long-lived token (about 20 min)

**Use the "Instagram API with Facebook Login" variant (graph.facebook.com).** It is the only variant that can do both of the things we need:

- publish to our own professional account (`instagram_content_publish`)
- read other accounts with Business Discovery (`business_discovery`, documented only under Facebook Login)

The Instagram Login variant (graph.instagram.com) is simpler and needs no Page, but it can't do Business Discovery. Don't set up both: Meta allows one API setup per app use case.

Everything below happens in **Development mode, with no App Review**, because everyone who logs in has a role on the app. That covers the demo. Real users without a role on the app would need App Review and Business Verification, which can't happen today.

## 0. What you need

- An Instagram account you can post test content to. Use a fresh demo account, not a real business.
- A Facebook account (personal) that will own the Page and be an admin of the Meta app.

## 1. Make the IG account professional (2 min, phone)

In the Instagram app: **Profile > ☰ > Settings and activity > Account type and tools > Switch to professional account**. Pick **Creator** or **Business**; both work.

## 2. Create a Facebook Page and link the IG account (3 min)

1. facebook.com > **Pages > Create new Page**. Any name and category works.
2. Link it: on the Page, **Settings > Linked accounts > Instagram > Connect account**, then log in to the IG account. You can also do this from the IG app: **Edit profile > Page > Connect**.
3. Your Facebook user must have full control of the Page. The creator of the Page has this by default.

## 3. Create the Meta app (5 min)

1. https://developers.facebook.com/apps > **Create app**.
2. App name, contact email > **Next**.
3. Use case: **"Manage messaging & content on Instagram"** > Next.
4. Business portfolio: **"I don't want to connect a business portfolio yet"** > Next > Go to dashboard.
5. Dashboard > **Use cases > Manage messaging & content on Instagram > Customize**.
6. Choose **"API setup with Facebook login"**. Not "with Instagram login".
7. Click **"Add all required permissions"**. That adds `instagram_basic`, `instagram_content_publish`, `pages_read_engagement`, `pages_show_list` and `business_management`.
8. Also add **`instagram_manage_insights`** in the same permissions list. The business_discovery reference lists it as required.
9. **App settings > Basic**: copy the **App ID** and **App secret**.

If teammates need tokens too: **App roles > Roles > Add people** as Developer or Tester. Each person accepts the invite at developers.facebook.com/requests.

## 4. Get a token in Graph API Explorer (3 min)

1. https://developers.facebook.com/tools/explorer
2. Right panel: **Meta App** = your app, **User or Page** = **User Token**.
3. **Permissions > Add a permission**. Add:
   `instagram_basic, instagram_content_publish, instagram_manage_insights, pages_show_list, pages_read_engagement, business_management`
   If one doesn't appear in the dropdown, type its name. If it is still missing, step 3.7 didn't save; go back and re-add it.
4. **Generate Access Token**. In the Facebook dialog, choose **Opt in to current Pages / Instagram accounts only** and **tick both the Page and the IG account**. Missing the IG account here is the most common cause of an empty `instagram_business_account` later.
5. Paste this into the Explorer query box and Submit (GET):
   ```
   me/accounts?fields=name,instagram_business_account{id,username}
   ```
   `instagram_business_account.id` (17841...) is your **`IG_USER_ID`**.

## 5. Exchange for a 60-day token (1 min)

```bash
curl -s "https://graph.facebook.com/v26.0/oauth/access_token?grant_type=fb_exchange_token&client_id=APP_ID&client_secret=APP_SECRET&fb_exchange_token=SHORT_TOKEN"
# -> {"access_token":"EAA...","token_type":"bearer","expires_in":5183...}
```

Put the values in the repo-root `.env`:

```
IG_USER_ID=17841...
IG_ACCESS_TOKEN=EAA...        # long-lived user token, ~60 days
```

## 6. Verify (1 min)

```bash
cd spikes/instagram
T=$(grep IG_ACCESS_TOKEN ../../.env | cut -d= -f2); U=$(grep IG_USER_ID ../../.env | cut -d= -f2)
curl -s "https://graph.facebook.com/v26.0/$U?fields=username,followers_count&access_token=$T"
curl -s "https://graph.facebook.com/v26.0/$U/content_publishing_limit?fields=config,quota_usage&access_token=$T"
node --env-file-if-exists=../../.env discover.mjs <some_public_creator>   # read-only
```

## Troubleshooting

| Error | Fix |
| - | - |
| `instagram_business_account` missing | IG isn't professional, isn't linked to the Page, or wasn't ticked in step 4.4. Re-run Generate Access Token and tick it. |
| `(#10) ... permission` on `/media` | `instagram_content_publish` isn't on the token. Add it in step 3.7, then regenerate in step 4. |
| Business Discovery error for a username | The target is a personal account, a private account, or age-gated. Pick a creator or business account. |
| `code=190` | Token expired or was pasted wrong. Redo steps 4 and 5. |
| Container `ERROR` | Media URL isn't publicly fetchable, or it's not a JPEG, or the video is outside spec (see README). |
