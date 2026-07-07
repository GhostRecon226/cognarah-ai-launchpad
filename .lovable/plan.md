## Redirect to articles list after publish

In `src/routes/_authenticated/admin/articles.$id.tsx`, the `save()` function currently only navigates when creating a new article (to the edit page for the new id). On publish of an existing article it just shows a toast and stays on the editor.

### Change
- After a successful `save(true)` (publish), navigate to `/admin/articles` (the articles list) for both new and existing articles.
- After a successful `save(false)` (draft), keep current behavior: stay on the editor; for new drafts still redirect to the newly created edit page so the user can continue editing.
- Keep the existing success toast.

Only `src/routes/_authenticated/admin/articles.$id.tsx` is touched.