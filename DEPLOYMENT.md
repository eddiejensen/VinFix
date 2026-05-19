# AutoVinFix deployment

## Google Sites shell (QA defect #1)

If visitors see **Search this site**, **Google Sites**, or **Report abuse**, the domain is still pointing at a Google Sites embed, not the React app.

**Fix:** Host the built app from `web/` (Render static site per `render.yaml`) and point DNS for `www.autovinfix.com` directly at that host. Do not iframe the app inside Google Sites.

1. Build: `npm --prefix web run build`
2. Deploy `web/dist` to Render (service `autovinfix`) or Netlify/Vercel with SPA fallback to `index.html`
3. In Squarespace/DNS, set `www` CNAME to the static host; remove Google Sites as the primary target

## Backend

API: `https://autofixhelp-api.onrender.com` (set `VITE_API_BASE_URL` at build time if different).

After deploy, verify **2005 GMC Yukon XL Denali 4WD** shows **6.0L V8** only (backend verified fitment).

## Tester analytics

- Events: `POST /analytics/events` with `sessionId`, `eventName`, `payload`
- Optional: `VITE_TESTER_FEEDBACK_URL` for in-app Report issue button
