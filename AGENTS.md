<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.

## What Lovable manages

Rules outside this block are the project's own. Change the pieces below in
Lovable, not by hand. With the [Lovable MCP](https://mcp.lovable.dev)
connected, `send_message` asks Lovable to do it; otherwise ask the user to
use the editor.

- **Database.** Do not add or edit `supabase/migrations/` or `drizzle/`.
  Ask Lovable to change the schema.
- **Generated files.** Do not edit a file whose header says it is automatically
  generated.
- **AI gateway.** Keep model calls on Lovable's gateway, and keep
  `LOVABLE_API_KEY` out of browser code.
- **Connectors.** Lovable provides native connectors. `list_connectors` shows
  which are enabled; `add_connector` only returns the dashboard link. When a
  connector is enabled, calls go through the connector gateway and need
  `LOVABLE_API_KEY`. When Lovable does not provide one, users can bring their
  own key and store it in Secrets.
- **Secrets.** Lovable manages them. Do not put secret values in the repo.
<!-- LOVABLE:END -->

## Em-Desh school site (imported from Tauno29/em-desh-private-school-to-be-sold-)
- Frontend is the original static HTML/JS/CSS in public/, kept verbatim; src/routes/index.tsx serves public/index.html at /. Why: faithful import, no React rewrite.
- API is the original src/school/routes.mjs (Web Request→Response), mounted at /.netlify/functions/app/* (the path the frontend JS calls) via src/school/runtime.server.ts, which injects the Cloud service client as `db` and the private `gallery` bucket as `storage`.
- Tables carry a school_ prefix (runtime maps bare names); RLS on, service-role only. Older non-prefixed tables are deprecated leftovers of a wrong import.
- Staff sign in with the ADMIN_CODE secret. Cookies patched to SameSite=None so the preview iframe keeps sessions.
- Learner portal and staff Learners/Applications tabs are retired (portal + /api/apply endpoints return 404; admin tabs hidden, JS kept). Why: owner wants applications by email only.
- Applications: public/apply.html (3 forms + optional hostel section, passport photo) posts to src/routes/api/application.ts, which stores a copy in school_application_forms + photo in gallery/applications/, then the browser forwards to Web3Forms (WEB3FORMS_ACCESS_KEY, inbox emdesh2019@gmail.com). Why: owner has no own domain; Web3Forms free tier is browser-side.
- Hero background: gallery image with homepage_role 'hero' becomes the .hero background (app.js).
- Palette is white and blue.
- External homepage/gallery reads use an allowlisted, credential-free public content adapter and Netlify same-origin proxy redirects to the stable Lovable production host; private storage signing stays on Cloud because managed service credentials cannot be exported to Netlify.
- Public homepage/gallery responses replace signed storage links with stable /school-api/media/<path> links (homepage/ and gallery/ prefixes only) and send cache headers. Why: lets Netlify and browsers cache the video and photos.
