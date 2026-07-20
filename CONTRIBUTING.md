# Contributing to Purr WA Export 🐾

Thanks for your interest in improving **Purr WA Export**! This is a small, single-file userscript, so contributing is easy and requires no build step.

## Ground rules

- Be respectful. This tool is for exporting **your own** data — keep discussions privacy-first.
- Keep it **dependency-light**: vanilla JS only. The single allowed runtime dependency is JSZip (via `@require`).
- Keep it **single-file**: everything lives in `purr-wa-export.user.js`.
- Keep the UI **CSP-safe**: build DOM with `document.createElement` (no `innerHTML` for the panel).

## Dev setup

There's no build. To hack on it:

1. Open the Tampermonkey dashboard → your installed **Purr WA Export** script.
2. Edit directly, or point Tampermonkey at your local file (`@require file://…` during dev).
3. Reload `web.whatsapp.com` to test.

### Syntax check

```bash
node --check purr-wa-export.user.js
```

### Testing without WhatsApp

The export logic (formats, toggles, zip, contacts) can be exercised against a **mock store** — stub `window.require('WAWebCollections')` with fake `Chat`/`Contact` objects and drive the panel via `window.__PURR`. Please verify these before opening a PR:

- [ ] Each format toggle (TXT / HTML / CSV) only emits its files.
- [ ] `.zip` is produced **only** when “Bundle everything” is checked.
- [ ] Contacts export produces readable numbers.
- [ ] Date-range filter includes/excludes correctly.

## Commit / PR

1. Fork → branch (`feat/…` or `fix/…`).
2. Bump `@version` in the userscript header if behavior changes.
3. Keep PRs focused; describe **what** and **why**.
4. Update the README if you add/rename an option.

## Reporting bugs

Use the **Bug report** issue template. Include your browser, WhatsApp Web state (logged in?), and the panel log output — never paste real message content or phone numbers.

---

Made with 🐾 by [0xheycat](https://github.com/0xheycat)
