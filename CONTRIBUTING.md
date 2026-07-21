# Contributing

Purr WA Export is intentionally a single-file userscript. Keep changes small, dependency-light, and compatible with the existing local-only export model.

Before opening a pull request:

```bash
npm ci
npm run check
```

Test the userscript on your own WhatsApp Web account with non-sensitive sample chats. Never include exported chats, contacts, cookies, session data, or account identifiers in issues or pull requests.

Update the userscript version, package version, and changelog together for releases.
