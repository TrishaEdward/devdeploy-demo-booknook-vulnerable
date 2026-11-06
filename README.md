# devdeploy-demo-booknook-vulnerable

A small full-stack bookshop (Express API + jQuery frontend + SQL via Sequelize/SQLite)
used as a demo repo for DevDeploy's security pipeline. **Expected outcome: BLOCKED.**

**This app is deliberately vulnerable. Never expose it to a network.**

It contains SQL injection (search + login), reflected/stored XSS, path traversal,
open redirect, command injection, SSRF, an IDOR, plaintext passwords, and an
old jQuery (3.4.1) with a CVE on CISA's actively-exploited list. Some of these
are caught by the scanners and some deliberately are not.

Each flaw is labelled `[FLAGGED]` or `[NOT FLAGGED]` in `index.js`. The full
write-up of what the pipeline catches, what it misses, and why is in
`docs/demo-apps-plan.md` in the DevDeploy project.

**UI:** a catalogue with generated book covers, per-book reviews and a sign-in dialog, under a red banner saying it is deliberately vulnerable.

Run locally: `npm install && npm start` → http://localhost:3000
Companion app that should pass: `devdeploy-demo-notekeeper-safe`.
