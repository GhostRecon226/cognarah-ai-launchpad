## Newsletter subscribers admin page

Add an admin-only page to view and export newsletter subscriber emails.

### 1. New admin route: `/admin/subscribers`
File: `src/routes/_authenticated/admin/subscribers.tsx`
- Uses `AdminShell` with `requiredRoles={["admin"]}`.
- Fetches all rows from `newsletter_subscribers` (email, created_at), ordered newest first.
- Shows:
  - Total subscriber count
  - Table: Email | Subscribed on (formatted date)
  - Search input to filter by email
  - "Export CSV" button that downloads `subscribers-YYYY-MM-DD.csv` with headers `email,subscribed_at` (client-side Blob download, no backend work needed)
- Empty state when there are no subscribers.

### 2. Add nav entry
File: `src/components/admin/admin-shell.tsx`
- Add `{ to: "/admin/subscribers", label: "Subscribers", icon: Mail, roles: ["admin"] }` to the `NAV` array (placed near Users). Import `Mail` from lucide-react.

### 3. RLS check
The `newsletter_subscribers` table already has policies. If admins cannot currently SELECT it, add a migration:
```sql
CREATE POLICY "Admins can view subscribers" ON public.newsletter_subscribers
FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
```
Only added if the existing policies don't already permit admin reads.

### Out of scope
- No email-service integration (Mailchimp, etc.)
- No delete/unsubscribe UI (existing unsubscribe tokens flow untouched)
- No server-side export endpoint — CSV is generated in the browser from the fetched rows
