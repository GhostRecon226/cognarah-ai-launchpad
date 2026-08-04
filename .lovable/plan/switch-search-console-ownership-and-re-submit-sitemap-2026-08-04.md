# Switch Search Console ownership and re-submit sitemap

## Goal
Move the project's Google Search Console integration to the `cognarah.ai@gmail.com` account and re-submit the sitemap from that account.

## Steps

1. **Disconnect the current Search Console connection**
   - Remove the linked "Chibuzor's Google Search Console" connection from the project so it stops being used.

2. **Connect the correct Google account**
   - Open the Google Search Console connector flow for the user to authenticate with `cognarah.ai@gmail.com`.
   - Link the new connection to the project.

3. **Verify the cognarah.com property under the new account**
   - List verified properties in the new account.
   - If `https://cognarah.com/` (or domain property) is not verified, request a meta-tag verification token, add it to the site `<head>`, and complete verification.

4. **Re-submit the sitemap**
   - Submit `https://cognarah.com/sitemap.xml` to the verified property under `cognarah.ai@gmail.com`.

## Outcome
The sitemap will be registered under the correct owning Search Console account, and the project will use that account for future Search Console operations.
