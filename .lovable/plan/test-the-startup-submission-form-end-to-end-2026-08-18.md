# Test the startup submission form end to end

Goal: submit one realistic fake startup through the live `/startups/submit` form, then confirm exactly how it lands in the backend and in the admin view.

## What happens

1. Drive the real form in a headless browser against the running preview and fill every field, including optional ones, with hypothetical data for a fictional startup (example: "Mavelo AI", Lagos, Nigeria, seed stage, LLM plus computer vision, two cofounders, funding, milestones, awards, press links, roadmap, WhatsApp contact).
2. Upload a small generated placeholder logo and two placeholder screenshots so the file upload path is exercised too.
3. Submit and confirm the success state renders.
4. Read the saved row back from the database and report field by field which values were captured, which are empty, and whether logo and screenshot URLs resolve.
5. Open `/admin/startups`, expand the new submission, and screenshot the detail panel so you can see the presentation.
6. Report anything that looks wrong: dropped fields, mangled formatting, broken images, or missing labels.

## Notes

- This creates one real row in the submissions table plus uploaded test images. I will leave it in place unless you ask me to delete it afterwards, so you can review it yourself.
- The notification email trigger will fire for this submission, so `info@cognarah.com` will receive one test alert.
- No code changes are part of this plan. If the test reveals gaps in what is captured or displayed, I will report them and propose fixes separately.
