Two SYSTEM_PROMPT edits in `src/lib/agent-core.server.ts` (no schema, no code path changes). The Source footer link stays in place so the "Preserve the Source URL" Claude constraint still holds.

## 1. Scope the source attribution to the reported news only

Right now the prompt tells the model to "Always cite the original source" and ends every body with a single `<p><em>Source:</em> <a>...</a></p>` footer. That reads as if the entire piece, including the Africa Angle, came from TechCrunch/etc.

Rewrite the SOURCING block and the ARTICLE STRUCTURE section so:

- Attribution and inline links belong only to the news reporting (Opening paragraph + Body). Any external fact, number, quote, or claim in those sections must be tied to the source.
- The Africa Angle section is Cognarah's own analysis. It must not cite, link, or attribute anything to the source publication. If it references outside facts (e.g. a Nigerian bill, a specific African startup), it can name them plainly but must not credit the news source for that context.
- Insert an explicit divider before the Africa Angle so the reader sees the shift in voice. Add a required subheading in the body HTML: `<h2>The Cognarah Angle</h2>` (or "Cognarah's Take" — pick one and use it consistently) immediately before the Africa Angle paragraph(s).
- Keep the existing footer link, but reword it so it clearly refers to the news portion only:
  `<p><em>Reporting sourced from</em> <a href="SOURCE_URL">Publication name</a>. Analysis and Africa Angle are Cognarah's own.</p>`

## 2. Add a controversial / provocative angle

Add a new section to SYSTEM_PROMPT between "AFRICA ANGLE EXAMPLES" and "DRAFT ONLY":

- Title: `EDITORIAL EDGE (required)`.
- Instruct the model to take a clear, defensible stance in the Africa Angle. No fence-sitting, no "time will tell", no both-sides mush.
- Encourage one provocative question or contrarian observation per piece that challenges the dominant narrative (e.g. "Why should African founders trust a US-regulated model with local user data?", "Is this really a win for Africa, or just cheaper extraction?").
- Guardrails so it stays credible, not tabloid:
  - Provocation must be grounded in a fact stated earlier in the article.
  - No personal attacks, no unverified accusations, no invented quotes.
  - No defamation of named people or companies.
  - No inflammatory language about ethnicity, religion, or nationality.
  - Controversy lives in the Africa Angle and closing line only, never in the Headline or news reporting sections (those stay straight and factual).

Also update the closing-line rule (item 5 in ARTICLE STRUCTURE) so it explicitly leaves the reader with a pointed question or a sharp opinion, not a summary.

## 3. Keep Claude's editor pass consistent

`refineWithClaude` currently tells Claude to "Preserve the Source URL and 'Source:' footer link exactly." Update that instruction to match the new footer wording ("Reporting sourced from …") and add: "Preserve the `<h2>The Cognarah Angle</h2>` divider and do not move source citations into the Cognarah Angle or closing line."

## Out of scope

- No changes to the schema, DB, categories, image pipeline, or Skills agent.
- No changes to how sources are fetched, deduped, or scored.
- No new UI. Existing drafts are not rewritten; only new agent runs pick up the new prompt.
