CipherNest Master Architectural Constitution (v2.0)
1. Architectural Philosophy
CipherNest is an enterprise-grade Security Operations Center (SOC) intelligence platform. The system design is rooted in three principles:

Idempotency: Identical inputs must yield identical, cached, and reliable outputs via strict canonicalization.

Auditable: Every user action is recorded in an immutable, append-only audit log.

Response-Focused: No security tool output is valid without an actionable remediation path (The "Action Center" Model).

2. Data Integrity & Normalization (The Input Layer)
Canonicalization Layer: Every input (domain, URL, IP) passes through a preprocess(input) utility:

Normalization: Strip http/s, www, query strings, and trailing slashes; enforce lowercase.

Fingerprinting: Create a scan_hash (md5(tool_id + normalized_input)).

Caching: Check the EventStore for an existing scan record within 60 minutes before executing any tool logic.

Normalization Wrapper: All tool service functions must wrap their logic in the preprocess() utility.

3. Security, Governance & Compliance
Immutable Audit Logging: Implement middleware for all routes that logs: req.user, req.url, req.body (sanitized), req.ip, timestamp, duration, and status_code.

RBAC (Role-Based Access Control): Implement middleware to enforce:

ROLE_ADMIN: Full access to configuration, simulation, and user management.

ROLE_SOC: Access to threat triage, active alerts, and remediation.

ROLE_CISO: Access to reporting, risk trends, and compliance metrics.

Feedback & Learning (Human-in-the-Loop): Every tool output must contain a "Report Inaccuracy" button. Feedback is stored in the AnalystCorrections DB to adjust future heuristic weights.

Privacy Policy: Implement a "Clear Local History" feature that wipes session-specific alert history and cache for the active user.

4. Operational Intelligence (The Orchestrator)
Intelligence Aggregation (apiOrchestrator.js): Orchestrates external dependencies:

Priority 1: Live API (VirusTotal, AbuseIPDB, NVD).

Priority 2: Cache (DB).

Priority 3: OSINT (GitHub-sourced JSON feeds).

Priority 4: Simulation (Strictly fallback-only).

Confidence Scoring: riskEngine.js must return a confidence_score (0.0–1.0) along with the risk_score (0–100).

Kill Chain Mapping: All alerts must include a mitre_category (e.g., T1059, T1071) to provide context.

5. UI/UX & Real-Time Interaction
State Aggregation: Replace "chatty" individual socket events with a single sync_dashboard state object emitted every 2s.

Component Pruning: Condense 21 tools into 5 logical Suites:

Cryptographic Suite (Hash, Encrypt, Decode, Base64, JWT).

System Discovery Suite (Port, Network, Subdomain).

Identity Intel Suite (Phishing, Breach, Reputation).

Local Guard Suite (Honeypot, Process Watcher).

Response Suite (Vault, 2FA, Audit).

Persona Views: Toggle UI state between SOC (Action Center/Live Map) and CISO (Trends/Compliance).

Attack Path Visualization: Logic layer connecting vulnerabilities (Port + Weak Password = Compromise path).

6. Implementation Task Priorities
P0 (Governance/Integrity): AuditLog middleware, RBAC middleware, normalizeDomain() utility.

P1 (Integration/Truth): API Orchestrator (replacing mocks), Structured Groq AI responses.

P2 (UX/Response): Attack Path visualization, Report Generator (PDF/JSON export), Analyst Feedback system.

