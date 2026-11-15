# FINN — ENAM submission

> Email to **assessment@enam.com** · Subject: **IIT Delhi – AI Engineer - 2027**
> Paste the cover note below into the email body. Links and checklist follow.

---

## Cover note (email body)

Subject: **IIT Delhi – AI Engineer - 2027**

Hello,

Here's my submission for the AI Engineer Build Challenge — **FINN**, a phone-first app for an
Indian-equities investor.

- **Live demo:** https://finn-tau-one.vercel.app  (best on a phone)
- **Code:** https://github.com/hardik-singh1087/finn

Too much market news every day — FINN shows only the few things that matter, then lets me go deep on
one company. One flow: **look → dig in → ask.**

- **Push (feed):** my portfolio's filings, most important first, routine hidden, auto-sorted into 16
  types. Plus **an alert I set** — unusual volume (≥2×) or a price move (≥5%), thresholds I control.
- **Pull (research):** a company's filings answered **only from its own annual report + concall
  transcripts** — cited, and "not found in the documents" when they don't say. Star feature:
  **Promised vs Delivered** — what management guided vs. what the numbers did over ~4 quarters, with
  a kept/missed verdict. Then I can ask my own questions, same grounded way.

**Key choices:** primary sources only on research (trustworthy over broad); **cost routing +
caching** — cheap model (Gemini Flash-Lite, free) for bulk classification/summaries, strong model
(Gemini Flash, free) only for promised-vs-delivered, and every answer cached to disk, so **running
cost is ₹0** and the demo serves from committed data with no live downloads (a full rebuild is still
under $1 on a paid tier).

**Left out on purpose:** live feeds, embeddings, accounts — and promised-vs-delivered is pre-built
for Infosys (the most interesting gap) but works for any ticker. **Next:** promised-vs-delivered
across all stocks, live alerts, and optional embeddings.

My AI build history is attached below. Thanks for the opportunity.

Best regards,
[Your name] · [phone · email]

---

## Links to include

- Live demo: **https://finn-tau-one.vercel.app**
- Repo: **https://github.com/hardik-singh1087/finn**
- AI build history: **<attach file or paste link>**

---

## Final checklist

**Product & code**
- [x] Live demo deployed and public (Vercel) — verified on a phone, full path works
- [x] Private GitHub repo, all 9 commits pushed (local == remote)
- [x] README complete — what it is, run, build, models/caching, data sources, "try this" path, live link
- [x] No secrets committed — `.env` is git-ignored and untracked; only `.env.example` is tracked; tree scanned clean
- [x] Working tree clean; auto-deploy connected (push to `main` → production)

**Before you hit send**
- [ ] ⚠️ **Repo access:** the repo is **private**, so `assessment@enam.com` can't open the link as-is.
      Either **make it public** before submitting, **add the reviewer as a collaborator**, or **attach a zip**.
- [ ] ⚠️ **Export and attach your AI build history** (this building chat) as a **link or file** — see below.
- [ ] Email to **assessment@enam.com**, subject exactly **"IIT Delhi – AI Engineer - 2027"**
- [ ] Paste the cover note; include the **live link** and the **repo link**
- [ ] Fill in your **name and contact** at the bottom of the note
- [ ] (Optional) Send yourself a test copy first, and open the live link on a phone one last time

**Reminder — AI build history**
Export this build conversation and attach it (or a link to it) to the email. In the Claude Code
desktop app you can export the session transcript from the session menu; I can also export it for you
here on request. Don't forget this — it's explicitly asked for.
