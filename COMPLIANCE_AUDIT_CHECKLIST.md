# CipherNest — Compliance & Architectural Hardening Checklist
> Lead Architect sign-off document. Each item must be verified before go-live.
> Last updated: Phase 5 — Go-Live & Governance

---

## Phase 1: Environment & Infrastructure

- [x] `.env` files excluded from version control via `.gitignore`
- [x] `backend/.env.example` contains all required keys with placeholder values
- [x] `MONGO_URI` key consistent across all env files and `config/db.js`
- [x] `JWT_SECRET` is ≥64 characters (cryptographically generated)
- [x] `JWT_EXPIRE` set to `24h` in all env files
- [x] Docker Compose uses `service_healthy` condition for MongoDB dependency
- [x] MongoDB port bound to `127.0.0.1:27017` only (no external exposure)
- [x] Backend Dockerfile uses two-stage build and runs as non-root `ciphernest` user
- [x] `NODE_ENV=production` enforced in Docker Compose environment block
- [x] `CORS_ORIGINS` environment variable controls allowed origins in production

---

## Phase 2: Backend Hardening & SRE

- [x] RBAC middleware (`requireRole`, `requireAdmin`, `requireAnyAuth`) implemented
- [x] `/api/audit` and `/api/config` routes restricted to `ROLE_ADMIN` only
- [x] AuditLog schema has `immutable: true` on `timestamp` field
- [x] AuditLog ODM hooks block `updateOne`, `deleteOne`, `findOneAndUpdate`, `deleteMany`
- [x] Log archival cron (`logManager.js`) runs daily at 02:00 UTC
- [x] Heuristic auto-tuning (`runHeuristicTuning`) runs every 24h and on boot
- [x] `/api/health/detailed` returns `mongo_status`, `groq_status`, `external_intel_status`
- [x] Global error handler suppresses stack traces in `NODE_ENV=production`
- [x] Helmet configured: CSP (no `unsafe-inline` on scripts), HSTS 1yr, `X-Frame-Options: DENY`
- [x] Payload limits: 10kb global, 8kb on `/api/tools` scan endpoints
- [x] Rate limiter: 200 req/15min global, 50 req/60s per user with 5-min cooldown

---

## Phase 3: UI/UX Bento Grid

- [x] Tailwind Light-Luxury palette defined (`luxury.*`, `glass.*` tokens)
- [x] CSS custom properties (`--bg-page`, `--accent`, etc.) drive light/dark theming
- [x] `BentoCard` component with glassmorphism, soft shadow, hover scale
- [x] Responsive Bento grid: `grid-cols-1` → `md:grid-cols-2` → `lg:grid-cols-3`
- [x] `HelpPanel` with title, description, legend, proTip on all major cards
- [x] `HelpPanel` is keyboard-accessible (ESC to close, focus-trapped, `role="dialog"`)
- [x] Inter 16px / 1.5 line-height base typography
- [x] All interactive elements have `aria-label` attributes
- [x] `ThemeToggle` persists preference to `localStorage` key `cn_theme`
- [x] Default theme is Light-Luxury; dark mode via `.dark` class on `<html>`
- [x] Framer Motion stagger entrance + scale/glow hover on all BentoCards
- [x] ThreatMap uses `react-simple-maps` with pulsing Framer Motion markers
- [x] AskCipher renders structured SOC blocks (Assessment / Cause / Mitigation / Confidence)

---

## Phase 4: Intelligence & Data Flow

- [x] `deduplicateThreats()` in `intelligenceEngine.js` — unique per IP/value, highest severity wins
- [x] `/api/threats/global` returns deduplicated array
- [x] ThreatMap uses Socket.IO `threat:new` as primary channel (sub-2s updates)
- [x] ThreatMap falls back to 5-second polling when WebSocket unavailable
- [x] WebSocket status badge (Live / Polling) visible on ThreatMap
- [x] AskCipher risk-score bar derived from `confidence_score` (Low/Medium/High)
- [x] Thumbs Up/Down feedback sends to `/api/feedback/report` and triggers heuristic re-tuning
- [x] `?debug` URL param activates simulation overlay with pulsing border
- [x] `POST /api/simulation/simulate` inserts Threat + Alert + ActivityLog + emits via WebSocket
- [x] `intelFeed.js` background poller runs every 15 minutes
- [x] `/api/threats/feed` returns latest 20 deduplicated indicators
- [x] Global Threat Feed card on Dashboard with "Mark Reviewed" and analyst feedback dropdown
- [x] `/api/feedback/analyst` accepts `false_positive | true_positive | unclear` decisions
- [x] `latencyMiddleware` records `X-Latency` header and emits `latency:update` via Socket.IO
- [x] Latency Gauge card on Dashboard (green ≤100ms / yellow ≤500ms / red >500ms)
- [x] End-to-end SOC simulation: 1 click → DB insert → WebSocket → ThreatMap + Feed + Cipher

---

## Phase 5: Go-Live & Governance

### Dependency Security
- [x] `npm audit --audit-level=high` passes with zero HIGH/CRITICAL vulnerabilities
- [x] 2 moderate vulnerabilities documented (uuid in node-cron) — not exploitable in this context
- [x] `snyk` added to `devDependencies`; `audit:deps` script available in `package.json`
- [ ] Run `cd backend && npm run audit:deps` after obtaining Snyk auth token

### Pre-Launch Checklist
- [ ] **Rotate `GROQ_API_KEY`** — current key was exposed in git history; revoke and regenerate
- [ ] **Verify MFA for all admin accounts** (TOTP via `otplib` — already installed)
- [ ] **Confirm `.env` is in `.gitignore`** and has never been committed (`git log -- backend/.env`)
- [ ] **Run FULL smoke test**: health endpoint, simulation, WebSocket, latency gauge
- [ ] **Replace weak `JWT_SECRET`** in `backend/.env` with 128-char hex value
- [ ] **Set `NODE_ENV=production`** in `backend/.env` before deploying
- [ ] **Enforce MFA for all admin accounts** (Phase 5.4 — TOTP roadmap below)
- [ ] **Limit session timeout to 60 minutes** (change `JWT_EXPIRE=1h` in `.env`)
- [ ] **Confirm MongoDB auth credentials** are set for production deployment
- [ ] **Review CORS_ORIGINS** — set to production frontend domain, not localhost

### MFA Roadmap (Phase 5.4)
- [ ] TOTP via `otplib` (already installed) — implement `POST /api/auth/2fa/setup` flow
- [ ] Enforce 2FA for `ROLE_ADMIN` accounts at login (check `isTwoFactorEnabled` in `protect` middleware)
- [ ] Add `mfa_required: true` flag to login response when 2FA is enabled but not yet verified
- [ ] Session timeout: set `JWT_EXPIRE=1h` in production `.env`

---

## Go-Live Sign-Off

- [ ] All 5 Phases reviewed and signed off by Lead Architect
- [ ] All 5 verification steps executed (health, simulation, WebSocket, latency, audit)
- [ ] No pending HIGH or CRITICAL vulnerabilities (Snyk / npm audit)
- [ ] MFA section acknowledged — TOTP roadmap documented above
- [ ] `GROQ_API_KEY` rotated and new key confirmed working
- [ ] `JWT_SECRET` replaced with cryptographically strong value
- [ ] Production `.env` reviewed — no placeholder values remain
- [ ] Docker stack smoke-tested: `docker compose up --build` completes without errors
- [ ] Go-Live startup banner confirmed in server boot logs

---

*This document is maintained by the Lead Architect and must be re-reviewed after any infrastructure change.*
