# Verification

Purr WA Export has no runtime package dependencies. Its authoritative gate runs on the repository's exact Git tree through the self-hosted Purr Verify runtime.

```bash
npm ci
npm run check
```

The gate verifies:

- userscript JavaScript syntax
- release version consistency
- canonical homepage, support, install, and update URLs
- required userscript metadata
- removal of stale `purr-wa-export` repository links

`npm audit` reports zero known vulnerabilities for the current dependency-free package tree.

The workflow template under `.github/workflows/ci.yml` mirrors these commands and can be enabled when hosted GitHub Actions are available. It is not required to install or use the userscript.
