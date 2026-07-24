<div align="center">

<img src="assets/logo.svg" alt="Purr WA Export" width="520" />

### Bulk-export your own WhatsApp Web chats to **TXT · HTML · CSV** — in one click.

A single-file userscript that reads WhatsApp Web's **internal message store directly** (no DOM scraping, no screenshots, no WA-JS). Pick some chats or all of them, choose your formats, hit export.

[![Verified](https://img.shields.io/badge/verified-self--hosted-00a884)](VERIFICATION.md)
[![version](https://img.shields.io/badge/version-1.0.1-00a884)](https://github.com/0xheycat/purr-wa/releases)
[![license](https://img.shields.io/badge/license-MIT-blue)](LICENSE)
[![userscript](https://img.shields.io/badge/type-userscript-f2c94c)](https://www.tampermonkey.net/)
[![project](https://img.shields.io/badge/project-0xheycat.xyz-f5b45a)](https://0xheycat.xyz)
[![made by](https://img.shields.io/badge/by-0xheycat-c04bff)](https://github.com/0xheycat)

<sub>Made with 🐾 by <a href="https://github.com/0xheycat">0xheycat</a> · <a href="https://x.com/0xheycat">@0xheycat</a></sub>

</div>

---

<img src="docs/install.gif" alt="Purr WA Export demo" width="600">

---

## ✨ Features

| | Feature |
|---|---|
| 💬 | **Bulk export** — select individual chats or *Select all* |
| 📄 | **Plain text** (`.txt`) — clean, readable transcript |
| 🌐 | **HTML web view** — WhatsApp-style chat bubbles, print → PDF |
| 📊 | **CSV** — one file per chat **+** an `ALL_combined.csv` |
| 🌙 | **Dark mode** for HTML exports |
| 👥 | **Group participants** export (name + number) |
| 📇 | **Contacts list** export (name + number) |
| 🗓️ | **Date-range filter** (from / to) |
| 🖼️ | **Media** — best-effort image embedding in HTML |
| 🗜️ | **One-click `.zip`** bundle of everything |
| 🔒 | **100% local** — nothing ever leaves your browser |

---

## 📽️ Watch: install in under a minute

> New to userscripts? No problem — here's the whole thing, start to finish.

<div align="center">

![Purr WA Export — install walkthrough](docs/install.gif)

</div>

<details>
<summary>▶️ Prefer the crisp MP4 version? (click to expand)</summary>

<br>

https://github.com/0xheycat/purr-wa/raw/main/docs/install.mp4

<sub>If the player doesn't load, <a href="docs/install.mp4">download <code>docs/install.mp4</code></a> and open it locally.</sub>

</details>

---

## 🚀 Install

1. Install a userscript manager: **[Tampermonkey](https://www.tampermonkey.net/)** (Chrome/Brave/Edge/Firefox) or **[Violentmonkey](https://violentmonkey.github.io/)**.
2. Open the **[direct install link](https://raw.githubusercontent.com/0xheycat/purr-wa/main/purr-wa-export.user.js)**. Tampermonkey or Violentmonkey will offer to install it.
   - Manual fallback: open [`purr-wa-export.user.js`](purr-wa-export.user.js), copy the source, then paste it into a new userscript.
3. Open **[web.whatsapp.com](https://web.whatsapp.com/)** and log in.
4. A floating **🐾 Purr WA Export** panel appears in the top-right corner.

---

## 🧭 How to use

1. Wait until the panel's status dot turns **green** (store ready).
2. Click **Scan chats** — every chat/group is listed.
3. Tick the chats you want (or **Select all**).
4. Choose your **formats** (TXT / HTML / CSV) and **options**.
5. *(optional)* set a **date range**.
6. Click **Export selected**. Files download automatically — or check **Bundle everything into one `.zip`** for a single archive.

> 💡 **Tip:** For a PDF, export **HTML**, open the file, and use your browser's *Print → Save as PDF*.

---

## 🔬 How it works

Purr talks to WhatsApp Web's own internal modules instead of scraping pixels or the DOM:

```
WAWebCollections.Chat  ──▶  Cmd.openChatAt({ chat })
                       ──▶  chat.waitForChatLoading()
                       ──▶  chat.getAllMsgs()  +  chat.msgs   (merged & de-duped)
```

Message bodies are read as plaintext directly from the loaded store, so exports are fast and accurate. No `WA-JS`/`WPP` dependency (both are broken on WhatsApp Web 2026) — the only external dependency is **JSZip** (loaded via `@require`).

---

## ⚠️ Honest limitations

- **Synced-history window.** WhatsApp Web (multi-device) only keeps a *limited window* of recent messages per chat synced to the browser. Older history lives on your phone and is **not** reachable from web JavaScript. Purr exports **everything available on the web** and gently scrolls to load more, but it cannot resurrect messages the web client never synced.
  - 👉 For **complete** history, use a phone backup export instead.
- **Media is best-effort.** Image embedding depends on what WhatsApp keeps cached; when bytes aren't available, Purr writes a `[Image]` placeholder instead of failing.
- **Numbers may be hidden.** WhatsApp's newer LID addressing hides some phone numbers; those show as `(hidden)`.
- Use this on **your own account and your own data**. Respect the privacy of the people in your chats and your local laws.

---

## ❓ FAQ

**Is my data uploaded anywhere?**
No. Export processing runs in your browser tab. There is no analytics or application server. The userscript loads JSZip from cdnjs and WhatsApp Web itself continues making its normal network requests.

**Why only recent messages for some chats?**
That's the WhatsApp multi-device sync window — see *Limitations* above.

**Does it work on the WhatsApp desktop app?**
It targets `web.whatsapp.com`. Use it in a browser.

---

## 🛠️ Tech

- Single-file **userscript**, vanilla JS, no build step.
- CSP-safe DOM building (no `innerHTML` injection for the panel).
- MIT-licensed and dependency-light.
- Repository validation checks userscript syntax, metadata, release version, and canonical project links.

---

## 📜 License

[MIT](LICENSE) © [0xheycat](https://github.com/0xheycat)

---

## Contributing

[![PRs welcome](https://img.shields.io/badge/PRs-welcome-00A884.svg)](CONTRIBUTING.md)
[![good first issues](https://img.shields.io/github/issues/0xheycat/purr-wa/good%20first%20issue?label=good%20first%20issues&color=7057ff)](https://github.com/0xheycat/purr-wa/labels/good%20first%20issue)

Contributions are welcome and appreciated! 🐾

- 📖 Read the [Contributing guide](CONTRIBUTING.md) and [Code of Conduct](CODE_OF_CONDUCT.md).
- 🌱 New here? Look for [`good first issue`](https://github.com/0xheycat/purr-wa/labels/good%20first%20issue).
- 💬 Ideas & questions → [Discussions](https://github.com/0xheycat/purr-wa/discussions).

---

## Keywords

<sub>`purr-wa` · `whatsapp-chat-export` · `whatsapp-web-exporter` · `export-whatsapp-to-pdf` · `whatsapp-to-csv` · `whatsapp-to-html` · `whatsapp-chat-backup` · `bulk-chat-export` · `userscript` · `tampermonkey` · `local-first` · `privacy-first` · `no-server` · `group-participants-export` · `contacts-export`</sub>

<div align="center"><sub>🐾 Purr WA Export — by 0xheycat</sub></div>
