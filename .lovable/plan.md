## Clear all articles

Delete every row from the `articles` table in the database so you can launch with a clean slate. The table, columns, policies, and indexes stay intact — only the data is removed.

### Technical details
- Run `DELETE FROM public.articles;` via the insert tool.
- No schema changes, no migration.
- Related tables like `authors`, `categories`, `agent_runs`, and `agent_seen_sources` are left untouched.

### Note
This is irreversible — once approved, all current articles and drafts are gone.