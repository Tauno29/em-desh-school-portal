# Fix everything broken on the Netlify site

## What's broken on Netlify
1. **Welcome video and background photo are missing.** Their new links return an error on Netlify, even though the same files load fine on Lovable.
2. **Application form can't be sent.** It sends to an address that only exists on Lovable.
3. **Staff area doesn't work.** Sign-in and uploads only exist on Lovable.

## Fix
1. **Video and photos:** link them straight to the Lovable site's media address, so they no longer go through Netlify. The speed gains stay.
2. **Application form:** send it to the Lovable site's application address, which then saves it and emails emdesh2019@gmail.com as before, passport photo included.
3. **Staff area:** on Netlify, the Staff link opens the working staff area on the Lovable site, so uploads still appear on both sites.
4. Publish, push to GitHub, then test the Netlify site in a real browser: homepage video plays, background photo shows, gallery and fees load, and a test application goes through (then delete the test).
5. Tell you to redeploy Netlify once, only for the parts that need it.

## Technical details
- `stabilizeMediaUrls` (src/school/public-content.ts): output `https://project--cf4a80e7-8301-450b-b19f-d5fb82508f21.lovable.app/api/public/school/media/<path>`; keep the homepage/ and gallery/ allowlist; add a HEAD handler. Netlify's 500 most likely comes from its own server build running the route without Cloud credentials. Remove the `/school-api/media/*` redirect and update the test.
- Application: add `src/routes/api/public/application.ts` reusing the existing handler, with CORS limited to the Netlify and Lovable origins and an OPTIONS handler; apply.js posts to the absolute Lovable URL when it isn't on a Lovable host. Keep the existing validation and size limits.
- Staff: admin links in the public pages use the absolute Lovable URL when not on a Lovable host (cookies are host-bound, so the staff area can't be proxied safely).
- AGENTS.md: record the "absolute Lovable URLs for anything server-side when served from Netlify" rule.
