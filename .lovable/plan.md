## Fixes for /startups/submit

### 1. Dropdown options showing as blank/white
On Windows the native `<option>` elements inherit the dark form styling, rendering white-on-white text. Fix by giving each `<option>` in the four selects (Company stage, Team size, Revenue stage, Preferred contact method) explicit dark text on a white background via inline styles: `style={{ color: "#0f172a", backgroundColor: "#ffffff" }}`. Applies to both the placeholder "Select…" options and the value options.

### 2. Raise max characters 300 → 500
Update both client and server:
- `src/routes/startups.submit.tsx`: change `maxLength={300}` → `500` and hint text "Max 300 characters" → "Max 500 characters" for `product_description` and `problem_solved`.
- `src/lib/startup-submissions.functions.ts` (lines 74-75): change the two `> 300` length guards to `> 500`.

No schema/DB changes needed (columns are unconstrained text).
