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

## Em-Desh school app
- Pages ported from the original repo live in src/views/ (ts-nocheck) and call `trpc.*` from src/lib/trpc.ts, a shim over one server fn (src/lib/rpc.functions.ts → rpc.server.ts dispatch table). Why: keeps the original UI verbatim; add new actions to the dispatch table.
- All school tables are service-role only (RLS on, no client policies); every read/write goes through rpc.server.ts, which checks admin role (Cloud auth bearer + user_roles) or the learner cookie session. Why: learners/parents sign in without Cloud accounts.
- Learner login = Student ID + 4-digit PIN, SHA-256 hashed exactly like the original so imported hashes keep working; session via useSession with SESSION_SECRET.
- First administrator is created from /admin when no admin exists; public sign-up is disabled. Why: no hardcoded admin credentials.
- Gallery bucket is private (workspace blocks public buckets); images are stored with 10-year signed links.
