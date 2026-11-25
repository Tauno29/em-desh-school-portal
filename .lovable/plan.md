# Fix the broken video and background photo on Netlify

## What broke
On Netlify, the homepage content loads, but the new video and photo addresses (`/school-api/media/...`) return an error page (500). On Lovable those same files load fine. Netlify can't serve these new addresses, so the welcome video and background photo disappear.

## Fix
1. Point the video and photo links straight at the Lovable site's media address (full https link), so they don't go through Netlify. The links stay fixed, so browsers can still remember the files, and the speed gains are kept.
2. Publish, then check the Netlify site in a real browser: the welcome video plays and the background photo shows, with no redeploy needed.
3. Push to GitHub so the next Netlify deploy matches.

## Technical details
- `stabilizeMediaUrls` in src/school/public-content.ts: rewrite to `https://project--cf4a80e7-8301-450b-b19f-d5fb82508f21.lovable.app/api/public/school/media/<path>` instead of the relative `/school-api/media/<path>`. Netlify's 500 is likely its own server build running the route without Cloud credentials; using an absolute link avoids Netlify entirely.
- Add a HEAD handler alongside GET on the public route (some browsers probe media with HEAD); keep the homepage/ and gallery/ allowlist.
- Update the unit test's expected URL; remove the unused `/school-api/media/*` rule from public/_redirects.
