<div align="center">

# 🛡️ CipherNest

**Production-Grade Cybersecurity Intelligence Platform**

*Real-Time Monitoring · AI-Powered Analysis · Active Defense · Threat Correlation*

---

[![Node.js](https://img.shields.io/badge/Backend-Node.js%20%2B%20Express-339933?style=flat-square&logo=node.js)](https://nodejs.org)
[![React](https://img.shields.io/badge/Frontend-React%2018%20%2B%20Vite-61DAFB?style=flat-square&logo=react)](https://react.dev)
[![MongoDB](https://img.shields.io/badge/Database-MongoDB-47A248?style=flat-square&logo=mongodb)](https://mongodb.com)
[![Socket.IO](https://img.shields.io/badge/RealTime-Socket.IO-010101?style=flat-square&logo=socketdotio)](https://socket.io)
[![Groq](https://img.shields.io/badge/AI-Groq%20%28LLaMA3%29-F55036?style=flat-square)](https://groq.com)

</div>

---

## Overview

CipherNest is not a collection of disconnected security tools. It is a unified, intelligent platform that runs a continuous cycle of **detection → analysis → correlation → remediation** across your local environment and global threat landscape simultaneously. Every component — from a detected open port to a honeypot trigger — flows through interconnected engines that update your security score, push AI-driven remediation to the Action Center, and stream alerts to the UI in real time without a single page refresh.

The platform is built on a dark cyber aesthetic using glassmorphism panels, animated SVG charts, and fluid micro-animations that make complex telemetry immediately readable and visually compelling.

---

## System Execution Flow

Understanding *how* CipherNest runs is critical before exploring its parts:

```
Server Boot
    │
    ├─► Socket.IO initialized (real-time event bus established)
    ├─► Global Threat Intelligence seeded from DB (or mock data generated)
    ├─► Resource Guard started (2-second system telemetry polling loop)
    ├─► Honeypot server bound to port 1024 (passive intrusion listener)
    ├─► Port Scanner started (10-second localhost scan cycle)
    ├─► Network Scanner started (15-second ARP discovery cycle)
    └─► Risk Snapshot Worker started (1-minute score capture interval)
             │
             ▼
    Continuous Operation
    ├── Backend Events  ──socket.io──►  React Frontend State Updates
    ├── Alerts Created               ►  Action Center Prioritized
    ├── Tool Results Written         ►  Security Score Recalculated
    ├── Pattern Engine Scans Logs    ►  Correlation Matches Automated
    └── User Queries Cipher AI       ►  Groq Streams Contextual Response
```

**Everything runs in parallel. There is no manual polling from the client.**

---

## Backend Services

The backend (`backend/services/`) is the operational core. Each service runs as an autonomous worker or is invoked by an API route.

---

### `resourceGuard.js` — Autonomous Resource Guard

**What it does:** Monitors CPU, RAM, disk, and network I/O continuously using the `systeminformation` library. Pushes live stats to every connected frontend client via Socket.IO every **2 seconds**.

**How CPU alerting works (no false positives):**
Rather than triggering on an instantaneous spike, the guard accumulates a rolling history of the last 30 CPU readings (covering 60 seconds). It calculates a **sustained moving average** before deciding whether to alert. This prevents one-off spikes (e.g., a file indexer) from generating noise.

```
Thresholds: CPU > 90% sustained · RAM > 90% · Disk > 95%
Alert Cooldown: 1 hour per alert type per user (enforced via DB timestamp check)
Stats Broadcast: Every 2 seconds via socket event `system_stats`
```

**What it detects:**
- Sustained high CPU (potential cryptojacking or runaway process)
- Memory exhaustion (DDoS memory flood or leak)

---

### `honeypotService.js` — Local Honeypot

**What it does:** Opens a real TCP server on port `1024` (a commonly scanned decoy port) bound to all interface addresses (`0.0.0.0`). Any connection attempt — whether from a local port scanner, a network probe, or a rogue device — is captured.

**Execution on trigger:**
1. Logs the attacker's remote IP to the console.
2. Creates a `critical` alert in MongoDB and broadcasts it via Socket.IO to the user's dashboard in real time.
3. Creates an `ActivityLog` entry with the source IP and port.
4. Terminates the connection with a message: *"Unauthorized Access. This attempt has been logged."*

```
Port: 1024 (bound on all interfaces)
Alert Type: Critical
Socket Event: new_alert
```

If the port is already in use at boot, the honeypot gracefully skips without crashing the server.

---

### `patternEngine.js` — Behavioral Pattern Detection

**What it does:** Analyzes the last 100 activity log entries for a user and identifies multi-event attack patterns. Unlike simple per-event alerts, this engine correlates sequences of events over time.

**Patterns detected:**

| Pattern | Trigger Condition | Severity | Automated Action |
|---|---|---|---|
| `BRUTE_FORCE_SUSPECT` | 5+ login/auth events within 60 seconds | High | Creates "Enable IP Rate Limiting" Recommendation |
| `RECURRING_UNKNOWN_DEVICE` | Unknown device appears in 3+ separate scan logs | Medium | Creates "Investigate Unknown Device" Recommendation |
| `REPEATED_WEAK_CREDENTIALS` | 3+ weak password/cracked entries in logs | High | Creates "Enforce Strong Password Policy" Recommendation |

All recommendations are upserted (created once, not duplicated), keeping the Action Center clean and non-redundant.

---

### `riskEngine.js` — Security Score & Risk Analysis

**What it does:** This is the mathematical core of the platform. It calculates and manages the user's Security Score (0–100) and powers multiple security analysis functions called by the tools API.

**Functions inside:**

- **`analyzePhishingRisk(url)`** — Scores a URL for phishing indicators:
  - IP address used as hostname: **+40 pts**
  - Suspicious TLDs (`.tk`, `.ml`, `.xyz`, etc.): **+30 pts**
  - Suspicious keywords in domain (e.g., `login`, `verify`, `paypal`): **+15 pts each**
  - No HTTPS: **+20 pts** · Too many subdomains: **+20 pts** · Long URL: **+10 pts**
  - Returns: `score`, `riskLevel`, `flags[]`, `verdict` (Safe / Suspicious / Dangerous)

- **`analyzePasswordStrength(password)`** — Entropy scoring:
  - Length ≥ 8: +20 · Length ≥ 12: +10 · Length ≥ 16: +10
  - Uppercase / lowercase / numbers / special chars: +15 each
  - Common passwords list check (e.g., `password`, `123456`): forces score ≤ 10
  - Returns: `score`, `strength`, `suggestions[]`, `riskLevel`

- **`analyzeDomainReputation(domain)`** — Trust scoring (starts at 70):
  - Suspicious keywords: -15 each · Low-trust TLDs: -25 each
  - Multiple subdomains: -10 · Sequential digit clusters: -10
  - Returns: `trustScore`, `riskLevel`, `flags[]`, `verdict`

- **`calculateAggregateRisk(signals)`** — Holistic risk calculation:

  | Signal | Risk Addition |
  |---|---|
  | Open ports > 5 | +50 |
  | Open ports > 0 | +20 |
  | Weak passwords detected | +35 |
  | Unknown devices on network | +30 |
  | Recent data breaches | +60 |
  | Pattern alerts active | +40 |
  | Global threat correlation matches | +55 |

- **`captureRiskSnapshot(userId)`** — Saves a `RiskTrend` DB entry only when the score has actually changed (prevents DB bloat). Runs on a 1-minute background interval across all users.

- **`updateSecurityScore(userId, riskLevel, toolType)`** — Adjusts the user's live security score after each tool run:
  - High risk result: **-10 pts** · Medium: **-5 pts** · Safe: **+2 pts**

- **`createAlertFromTool(userId, toolType, riskLevel, message)`** — Auto-creates DB alerts and high-priority Recommendations from tool results without any manual user action.

---

### `globalThreatService.js` — Global Threat Intelligence

**What it does:** Seeds and refreshes the global threat indicator database. Designed to integrate with VirusTotal or AbuseIPDB when API keys are present. Without keys, generates 85 realistic, weighted mock indicators across geographies, categories, and severity levels.

**Mock Threat Generation (when no external API keys present):**

- **Categories:** Botnet/Brute Force, Phishing, SSH Brute Force, Malware Host, Spam, Ransomware (LockBit), C2 Server, Credential Harvester, DDoS Reflector
- **Geographic Weighting:** China (15), Russia (12), United States (10), Brazil (8), Netherlands (6), Romania (5), North Korea (3), Iran (4), Unknown (4)
- **Indicator Types:** IP addresses, malicious domains, malware payload URLs, SHA-256 ransomware hashes
- **Severities:** low · medium · high · critical

`getGlobalDashboardData()` aggregates stored threats, producing country rankings, threat-type breakdowns (malware / phishing / botnet / exploit), and the 10 most recent threat entries — all consumed by the Global Dashboard page.

---

### `intelligenceEngine.js` — Local ↔ Global Correlation Engine

**What it does:** Bridges the gap between what is happening on your machine and what is happening globally. Pulls your active, un-dismissed local alerts and compares them against every indicator in the global threat database.

**Correlation logic:**
1. Extracts any IP addresses found in local alert messages using regex.
2. Queries the `GlobalThreat` collection for a matching indicator value.
3. On match: creates a high-priority `Recommendation` to block the malicious IP via firewall rules.
4. Passes all matches to the **Groq AI** which generates a live, streaming "So What?" explanation summarizing the correlation in plain English.

This means if your honeypot logs a connection from an IP that is also in the global threat DB, CipherNest automatically elevates and explains that incident — without any user input.

---

### `groqService.js` — AI Security Assistant (Cipher)

**What it does:** Provides the intelligence layer for the platform. Every AI response goes through this service, which communicates directly with the Groq inference API over raw HTTPS (no SDK dependency).

**How it works:**

1. Builds a structured prompt that includes a system persona (`Cipher` — a world-class cybersecurity analyst), the active tool result and risk context, and the last 6 turns of conversation history.
2. Sends the payload to `api.groq.com/openai/v1/chat/completions` with the configured model (default: `llama3-8b-8192`).
3. Supports both **streaming** (token-by-token, for real-time UI rendering) and **blocking** (for background correlation jobs).
4. A custom `Transform` stream (`convertGroqStreamToOllamaFormat`) translates Groq's Server-Sent Events format into newline-delimited JSON, keeping the response handler consistent across all call types.

**Fallback behavior:** If `GROQ_API_KEY` is missing or the request times out (20-second hard limit), Cipher returns pre-written, risk-aware fallback messages rather than a generic error.

**Context awareness:** The prompt is dynamically built with the tool type, risk level, and result summary, so the AI response is always specific to the exact operation — not generic cybersecurity advice.

---

### `reconService.js` — Reconnaissance & Background Scanners

Contains three functions that run or are called independently:

**`startPortScanner(userId)`** — Runs every **10 seconds** in the background.
- Targets 13 high-value ports on `127.0.0.1`: `21 (FTP)`, `22 (SSH)`, `23 (Telnet)`, `25 (SMTP)`, `53 (DNS)`, `80 (HTTP)`, `443 (HTTPS)`, `3000`, `3306 (MySQL)`, `5000`, `5432 (PostgreSQL)`, `8080`, `27017 (MongoDB)`.
- Opens each socket with a 200ms timeout. Open ports are collected and broadcast via socket event `port-update`.
- A 10% probability random trigger simulates logging a risky port detection in the `ActivityLog`, keeping the timeline active even during quiet periods.

**`startNetworkScanner(userId)`** — Runs every **15 seconds**.
- Maintains a baseline of known devices (Gateway, Workstation).
- On a 15% probability each cycle, injects a rogue device with a randomized IP (`192.168.1.100–150`) and unknown vendor onto the device list.
- When a rogue device is detected, a `critical` alert is immediately created in MongoDB and broadcast to the UI via socket event `network-update`.

**`enumerateSubdomains(domain)`** — Called on-demand by the Subdomain Recon tool.
- Tests 20 common prefixes (`www`, `api`, `admin`, `vpn`, `staging`, `dev`, etc.) for a given domain.
- Returns a list of discovered subdomains with simulated IP addresses, scan counts, and timestamps.

---

### `hashService.js` — Smart Hash Decoder

**What it does:** Identifies hash type by character pattern/length, performs a dictionary attack, estimates crack time, and classifies password strength.

**Hash type detection:**
- 32-char hex → `MD5`
- 40-char hex → `SHA-1`
- 64-char hex → `SHA-256`

**Dictionary (18 common weak passwords):** `password`, `123456`, `123456789`, `qwerty`, `password123`, `admin`, `welcome`, `login`, `security`, `12345`, `password1`, `p@ssword`, `guest`, `root`, `user123`, `iloveyou`, `sunshine`, `princess`

For each candidate, the service computes the actual hash using Node.js's native `crypto` module and compares it byte-by-byte — making it a real cryptographic lookup, not a mock.

**Crack time estimates (for non-dictionary hashes):**
- MD5 → *Hours to Days (on modern hardware)*
- SHA-1 → *Days to Weeks*
- SHA-256 → *Years (unless weak password used)*

**Insight generated:** Flags the algorithmic weakness (MD5/SHA-1 being fast-hashable and rainbow-table-vulnerable) and recommends migration to Argon2 or bcrypt.

---

### `simulationService.js` — Attack Simulation Engine

**What it does:** Provides a safe, controlled environment to demonstrate all platform capabilities without real infrastructure or malware. Activated/deactivated via the `/api/simulation` route.

**Simulation scenarios (randomly selected every 10 seconds, 40% probability each cycle):**

1. **Unauthorized Login Attempt** — Creates a `critical` alert with a realistic Russian IP `45.122.3.44` and triggers a socket broadcast.
2. **Brute Force on SSH** — Creates an `ActivityLog` entry simulating multiple failed login attempts on port 22.
3. **Rogue Device Detected** — Injects a device with MAC `DE:AD:BE:EF:CA:FE` into the network and creates a `warning` alert.
4. **Global Threat Spike** — Refreshes global threat data, runs the correlation engine against local alerts, and runs the pattern detection engine — simulating a full end-to-end intelligence cycle.

Everything generated by the simulator writes to the real database and triggers real alerts, demonstrating exactly how the platform behaves under genuine attack conditions.

---

### `socketService.js` — Real-Time Event Bus

Wraps Socket.IO initialization and exposes `emitEvent(event, data)` as a globally shared function. All backend services use this single function to push data to connected clients without needing their own Socket.IO references. This decouples services from the transport layer entirely.

---

## Frontend Pages

All pages are React single-page components loaded via React Router. The frontend connects to the backend on port `5000` (Axios REST API) and port `5000` (Socket.IO WebSocket).

---

### `Dashboard.jsx` — The Command Center

The primary landing page after login. Displays:
- **Live Security Score** (0–100) with animated ring gauge
- **Active Alerts** with severity badges (Critical / Warning / Info)
- **Threat Timeline** — live, chronological event stream
- **System Resource Metrics** (CPU, RAM, disk) via Socket.IO `system_stats`
- **Action Center** — prioritized, AI-annotated remediation task list
- **Risk Trend Chart** — Recharts line graph of score history over time

All panels update in real time without refresh. Incoming `new_alert` socket events trigger CSS pulse animations on alert cards and immediately decrement the Security Score.

---

### `WiFiGuard.jsx` — Wi-Fi Intelligence Console

The most visually complex page in the platform. A three-column interface:

**Left column — Network Discovery:**
- Auto-scan every 30 seconds (with on-demand manual trigger)
- Each detected network shows: SSID, BSSID, authentication type (WPA3/WPA2/WEP/Open), vendor, channel, frequency band, and animated signal strength bars
- Evil Twin candidates flagged with a ⚡ badge
- Networks sorted by risk level (HIGH → MEDIUM → LOW → UNKNOWN)

**Center column — Detail Analysis Panel + Security Terminal:**
- **Risk Gauge** — animated SVG circular gauge that fills and glows in the risk color
- **Signal History Graph** — Canvas-drawn real-time signal strength waveform with gradient fill
- **Threat Indicators** — per-network list of detected security concerns
- **Recommendations** — per-network hardening advice
- **Connection Status Button** — "BLOCKED", "CAUTION", or "SAFE" based on risk level
- **Security Terminal** — scrolling log console showing all scan events with color-coded severity entries

**Right column — Channel Congestion Heatmap:**
- Bar chart of all 14 Wi-Fi channels (2.4 GHz)
- Crowded channels (3+ networks) turn red and glow
- Live countdown ticker in the header bar shows next scan time, strongest/weakest network, channel list, new/lost network counts, and average signal strength

---

### `ToolsPage.jsx` — Security Toolkit

21 tools in two categories, each fully integrated with the backend API:

**Security Scanners:**

| Tool | Input | What It Does |
|---|---|---|
| 🎣 Phishing Detector | URL | Heuristic risk scoring with flag-by-flag breakdown |
| 🔑 Password Analyzer | Password | Entropy scoring, strength meter, actionable suggestions |
| 📧 Breach Checker | Email | Checks against simulated major data dump databases |
| 🌐 Domain Reputation | Domain | Trust score, TLD and keyword analysis, verdict |
| 🔍 Web Vulnerability Scanner | URL | Security headers, SSL, CSP, HTTPS, response time grading |
| 🗺️ Live Threat Map | — | Navigates to Global Dashboard (real-time attack visualization) |
| 🎯 Subdomain Recon | Domain | Discovers hidden subdomains with simulated IP resolution |
| 🔌 Port Scanner | Target | Real TCP connection scan against localhost ports |
| 📍 IP Analyzer | IP Address | Geo-lookup, ISP, org, risk flags |
| 🪤 Local Honeypot | — | Navigates to dedicated Honeypot management page |
| 🕵️ Process Watcher | — | Navigates to live system process analysis |
| 🕵️‍♂️ Dark Web Monitor | Email | Checks for identity exposure in dark web breach datasets |
| 🧪 AI File Sandbox | Filename | AI-driven static behavior analysis of suspicious files |

**Security Utilities:**

| Tool | Input | What It Does |
|---|---|---|
| 🔒 Text Encrypt/Decrypt | Text + Key | AES encryption/decryption |
| #️⃣ Hash Generator | Text + Algorithm | Generates MD5, SHA-1, SHA-256, SHA-512 hashes |
| 🔓 Smart Hash Decoder | Hash | Dictionary attack, crack time, strength classification |
| 🖼️ Metadata Stripper | JSON Metadata | Strips EXIF/hidden metadata from simulated file payloads |
| 🛡️ 2FA Manager | — | Navigates to Vault page with MFA configuration |
| 📝 Base64 Encoder | Text | Encode/decode Base64 in both directions |
| 01 Binary Converter | Text | Text ↔ Binary conversion |
| 🪙 JWT Decoder | JWT Token | Decodes header/payload, detects token expiry |

Every tool result that produces a medium or high risk automatically:
1. Creates an alert in the database
2. Decrements the Security Score
3. Creates a high-priority Recommendation in the Action Center

---

### `AskCipher.jsx` — AI Security Assistant

A full-screen chat interface for the Groq-powered `Cipher` AI. Responses stream token-by-token from the backend. The AI maintains the last 6 conversation turns for context continuity. Cipher is context-aware — it knows what security tool was last used, the active risk level, and the result summary, allowing it to provide precise rather than generic advice.

---

### `Vault.jsx` — Encrypted Secret Storage

Stores API keys, passwords, and sensitive notes. All items are encrypted with **AES-256-CBC** before being written to MongoDB. Decryption happens server-side on-demand; the plaintext never persists to disk and is cleared after the response. Also houses the **2FA (TOTP) manager** for MFA configuration.

---

### `GlobalDashboard.jsx` — Global Threat Intelligence View

Displays aggregated data from the `GlobalThreat` collection:
- Total active threat indicators
- Top 5 threat-origin countries with counts (weighted by geographic threat activity)
- Threat-type breakdown (Malware / Phishing / Botnet / Exploit) rendered as charts
- 10 most recently seen threat entries

---

### `ThreatMap.jsx` — Live Threat Map Visualization

Visual representation of real-time global cyber attacks rendered as an animated geopolitical map. Attack origins are pulled from the Global Threat Intelligence database.

---

### `NetworkMap.jsx` — Network Topology Visualization

Interactive map of discovered devices on the local subnet. Devices discovered by the background Network Scanner appear here with type, vendor, IP, MAC, and status. Unknown/rogue devices are visually distinguished.

---

### `ProcessWatcher.jsx` — System Process Monitor

Live view of running system processes with resource consumption metrics. Allows users to identify high-CPU or suspicious background applications from within the CipherNest interface without opening a separate process manager.

---

### `Honeypot.jsx` — Honeypot Management

Dedicated page for monitoring and managing the local honeypot. Displays a live feed of connection attempts captured by the TCP listener on port 1024.

---

## Security Architecture

### Authentication

| Mechanism | Implementation |
|---|---|
| Password Hashing | `bcryptjs` — 10 salt rounds |
| Session Tokens | JSON Web Tokens (`jsonwebtoken`) — 7-day expiry |
| Transport Security | `helmet` middleware (security headers on all responses) |
| Rate Limiting | `express-rate-limit` — 200 requests per 15 minutes per IP |

### Data Security

| Item | Implementation |
|---|---|
| Vault Encryption | AES-256-CBC (`crypto-js`) — never stored as plaintext |
| Port Scanning Scope | Strictly `127.0.0.1` — no external network abuse possible |
| CORS Policy | Locked to `localhost:5173` and `127.0.0.1:5173` only |

---

## UI Design System

The frontend is built with **React 18 + Vite** and styled with **Tailwind CSS** using a custom `cyber` token set. All UI decisions are intentional and documented here:

**Color System:**
- `cyber-bg` — Primary dark background (`#070B14`)
- `cyber-text` — Primary readable text (off-white)
- `cyber-accent` — Cyan accent (`#00D4FF`) for interactive elements, borders, glows
- `cyber-green` — Safe/OK state (`#00FF88`)
- `cyber-red` — Critical state (`#FF3366`)
- `cyber-yellow` — Warning state (`#FFD700`)
- `cyber-muted` — Subdued labels and monospace metadata

**Animation Inventory:**
- **`animate-pulse`** — Active alert hearts, live monitoring indicators, the security terminal cursor blink
- **`animate-spin`** — Scan loading states (`border-t` partial spinner pattern)
- **`animate-fadeIn`** — Every page entry (CSS opacity + translate-Y transition)
- **SVG Stroke Animation** — Risk Gauge (`stroke-dashoffset` driven by score, `transition: 0.8s ease`)
- **Canvas Signal Graph** — Wi-Fi signal history rendered by direct `CanvasRenderingContext2D` calls with gradient fills and live dot indicator
- **CSS Glow Effects** — `drop-shadow` filters on SVG gauge arcs, risk-colored box shadows on alert cards
- **Glassmorphism** — `backdrop-blur`, semi-transparent `rgba` backgrounds, subtle `1px solid` borders on all panels
- **Recharts** — Animated SVG line/area charts for risk trend, resource usage, and threat volume data
- **Tailwind Transitions** — `transition-all`, `duration-500/700` on score bars, channel heatmap bar heights, network card selection borders

---

## Backend API Routes

| Route Prefix | Handler | Purpose |
|---|---|---|
| `/api/auth` | `authController` | Register, login, JWT issuance |
| `/api/dashboard` | `dashboardRoutes` | Security score, alerts, timeline, action center |
| `/api/tools` | `toolRoutes` | All 21 security tool endpoints |
| `/api/wifi` | `wifiRoutes` | Wi-Fi scan and network analysis |
| `/api/chat` | `chatRoutes` | AI assistant (streaming + blocking) |
| `/api/alerts` | `alertRoutes` | CRUD for security alerts |
| `/api/secrets` | `secretRoutes` | Encrypted vault CRUD |
| `/api/reports` | `reportRoutes` | PDF/JSON report generation |
| `/api/network` | `networkRoutes` | Network device discovery |
| `/api/processes` | `processRoutes` | Running process telemetry |
| `/api/simulation` | `simulationRoutes` | Start/stop attack simulation |
| `/api/threats` | `threatRoutes` | Global threat intelligence data |
| `/api/actions` | `actionRoutes` | Action Center task management |
| `/api/health` | Inline | Server status check |

---

## Technology Stack

**Backend:**

| Package | Version | Role |
|---|---|---|
| `express` | ^4.18.2 | HTTP API server |
| `mongoose` | ^8.0.0 | MongoDB ODM |
| `socket.io` | ^4.8.3 | Real-time event transport |
| `jsonwebtoken` | ^9.0.2 | JWT authentication |
| `bcryptjs` | ^2.4.3 | Password hashing |
| `crypto-js` | ^4.2.0 | AES-256 vault encryption |
| `systeminformation` | ^5.21.22 | CPU/RAM/disk/network telemetry |
| `helmet` | ^8.1.0 | HTTP security headers |
| `express-rate-limit` | ^8.3.2 | API rate limiting |
| `otplib` | ^13.4.0 | TOTP 2FA generation |
| `qrcode` | ^1.5.4 | QR code for 2FA setup |
| `node-wifi` | ^2.0.16 | Wi-Fi network scanning |
| `axios` | ^1.6.0 | External HTTP requests |
| `dotenv` | ^16.3.1 | Environment variable loading |
| `nodemon` | ^3.0.2 | Dev server auto-restart |

**Frontend:**

| Package | Version | Role |
|---|---|---|
| `react` | ^18.2.0 | UI component framework |
| `react-dom` | ^18.2.0 | DOM rendering |
| `react-router-dom` | ^6.20.0 | Client-side routing |
| `vite` | ^5.0.0 | Dev server and build bundler |
| `tailwindcss` | ^3.3.5 | Utility-first styling |
| `recharts` | ^2.9.0 | Animated SVG chart library |
| `socket.io-client` | ^4.8.3 | WebSocket connection to backend |
| `axios` | ^1.6.0 | REST API client |
| `lucide-react` | ^1.7.0 | Scalable vector icon set |

---

## Setup & Execution

### Prerequisites

- **Node.js** v18 or higher
- **MongoDB** running locally on port `27017`  
  *(Start with: `mongod` or `brew services start mongodb-community`)*
- **Groq API Key** — Free at [console.groq.com](https://console.groq.com)

---

### Step 1 — One-Command Install

From the project root, this single command installs all backend and frontend dependencies:

```bash
npm run install:all
```

---

### Step 2 — Configure Environment

Copy the example file and fill in your credentials:

```bash
cp backend/.env.example backend/.env
```

Edit `backend/.env`:

```env
# Server
PORT=5000
NODE_ENV=development

# Database
MONGODB_URI=mongodb://127.0.0.1:27017/ciphernest

# Authentication (use any strong random string)
JWT_SECRET=your_super_secret_jwt_signature_key_here

# AI Intelligence Layer (required for Cipher AI assistant)
GROQ_API_KEY=gsk_your_groq_api_key_here

# Optional: Real Threat Intelligence APIs
# VIRUSTOTAL_API_KEY=your_vt_key
# ABUSEIPDB_API_KEY=your_abuseipdb_key
```

---

### Step 3 — Start the Platform

Open two terminal windows in the project root:

**Terminal 1 — Backend (all autonomous services start here):**

```bash
npm run dev:backend
```

On successful boot, you will see:

```
🛡️  CipherNest backend running on port 5000
🌐 Global threat intelligence updated.
📊 Risk snapshot worker started.
🤖 Groq AI status: Online (Model: llama3-8b-8192)
🛡️  Autonomous Resource Guard: Active
🪤  Local Honeypot: Listening on port 1024
📡 Starting background port scanner (localhost)...
🌐 Starting background network discovery...
```

**Terminal 2 — Frontend:**

```bash
npm run dev:frontend
```

Open your browser at: **`http://localhost:5173`**

---

### Step 4 — Register and Explore

1. Navigate to `/register` and create your account.
2. Log in at `/login`.
3. The Dashboard will immediately begin receiving live telemetry from the backend services.
4. Use **Simulation Mode** (via `/api/simulation/start`) to trigger a full attack scenario and watch every engine respond in real time.

---

## Environment Variable Reference

| Variable | Required | Description |
|---|---|---|
| `PORT` | No (default: 5000) | Backend server port |
| `NODE_ENV` | No (default: development) | Environment mode |
| `MONGODB_URI` | **Yes** | MongoDB connection string |
| `JWT_SECRET` | **Yes** | JWT signing key (keep secret) |
| `GROQ_API_KEY` | **Yes (for AI)** | Groq API key starting with `gsk_` |
| `GROQ_MODEL` | No (default: `llama3-8b-8192`) | Groq model to use |
| `VIRUSTOTAL_API_KEY` | No | Enables real VirusTotal threat lookups |
| `ABUSEIPDB_API_KEY` | No | Enables real AbuseIPDB IP reputation checks |

---

## Real vs. Simulated Features

| Feature | Status | Notes |
|---|---|---|
| Port Scanner (localhost) | ✅ **Real** | Actual TCP socket connections |
| Resource Monitoring (CPU/RAM/Disk) | ✅ **Real** | Via `systeminformation` library |
| Honeypot TCP Listener | ✅ **Real** | Actual OS-level TCP server |
| AES-256 Vault Encryption | ✅ **Real** | `crypto-js` AES-CBC |
| Hash Decoder (MD5/SHA-1/SHA-256) | ✅ **Real** | Native `crypto` module |
| Groq AI Assistant | ✅ **Real** | Requires `GROQ_API_KEY` |
| TOTP 2FA | ✅ **Real** | `otplib` standard |
| Wi-Fi Scanning | ✅ **Real** | `node-wifi` (result quality depends on OS/permissions) |
| Network Device Discovery | 🔵 **Simulated** | ARP simulation; real ARP requires privileged access |
| Global Threat Intelligence | 🔵 **Simulated** | Mock until VirusTotal/AbuseIPDB keys provided |
| Phishing / Domain / Breach / Dark Web | 🔵 **Simulated** | Heuristic logic + mock databases; API-swap ready |
| IP Geolocation | 🔵 **Simulated** | Mock geo data; production integration-ready |

---

## Security Notes

- Passwords are hashed with **bcrypt** (10 rounds) — never stored in plaintext.
- Vault items are encrypted with **AES-256-CBC** at rest; plaintext exists only in transient server memory during a decryption request.
- JWT tokens expire after **7 days**. Rotate `JWT_SECRET` immediately if you suspect it is compromised.
- The port scanner is **hard-coded to `127.0.0.1`** — it cannot be redirected to scan external targets.
- CORS is explicitly locked to `localhost` — the API will reject requests from any other origin.
- The rate limiter blocks any IP that exceeds **200 API requests** in 15 minutes.

---

## Future Scope

- **OSINT Integrations** — Direct live API connectors to Shodan and Censys for external footprinting.
- **Automated Mitigation** — CipherNest-triggered firewall rule generation to autonomously block attacking IPs.
- **Enterprise RBAC** — Role-Based Access Control for multi-analyst Security Operations Center (SOC) environments.
- **Real ARP Network Scanning** — Privileged packet-level scan for true network device discovery.
- **SIEM Log Ingestion** — Accept and correlate external security event sources (syslog, cloud logs).
