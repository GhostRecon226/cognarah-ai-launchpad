# Tidy the startup submissions table and add delete

## Fix the layout

The rows misalign because each column is a flexible equal share while the Actions cell changes width depending on which buttons a row shows (Preview email only, or plus View Article / Generate Draft). Result: company, founder, country and stage drift out of line row to row.

Changes:
- Give the header and every row one shared fixed column template, with the Actions column pinned to a fixed width so it no longer pushes the text columns around.
- Right-align actions inside that fixed column, so rows with fewer buttons keep the same alignment.
- Truncate long values (company, founder, country) instead of letting them wrap and change row height.
- Keep the mobile stacked layout as it is today.

## Delete submissions

- Add a trash-icon button in the Actions column of each row, styled like the existing reject button.
- Clicking asks for confirmation naming the company, then removes the submission and shows a toast.
- The row disappears from the list and the status counts update immediately.
- Access rules already in the backend allow only admins to delete, so an editor sees no delete button.
- If a submission already has a generated article, the article is left untouched; the confirmation mentions this.

## Technical notes

- Single file change: `src/routes/_authenticated/admin/startups.tsx`.
- Column template becomes something like `grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,0.8fr)_minmax(0,0.8fr)_96px_320px]` applied identically to header and rows, with `min-w-0` on text cells and `truncate` on their content; wrap the table body in `overflow-x-auto` so narrow desktop widths scroll rather than squash.
- Delete calls `supabase.from("startup_submissions").delete().eq("id", id)`; the existing admin-only DELETE policy and grants are already in place, so no migration is needed.
- Gate the button with the existing `useRoles().hasRole("admin")` helper.
