# CipherNest — Observability, Uptime & SLO

---

## 1. Health Check Endpoint

**Endpoint:** `GET http://<host>:5000/api/health`
**Expected response:** HTTP 200
```json
{ "status": "ok", "service": "CipherNest API", "timestamp": "..." }
```

**Detailed health (authenticated):** `GET /api/health/detailed`
Returns: `mongo_status`, `groq_status`, `external_intel_status`, latency per service.

---

## 2. Nagios-Style Uptime Check

### Manual curl probe:
```bash
curl -L --max-time 30 -s -o /dev/null -w "%{http_code}" http://localhost:5000/api/health
# Expected: 200
```

### Full response check:
```bash
curl -L --max-time 30 http://localhost:5000/api/health | \
  python3 -c "import sys,json; d=json.load(sys.stdin); exit(0 if d.get('status')=='ok' else 1)"
echo "Exit code: $?"
# Expected: Exit code: 0
```

### Nagios check_http plugin:
```bash
/usr/lib/nagios/plugins/check_http \
  -H localhost \
  -p 5000 \
  -u /api/health \
  -s '"status":"ok"' \
  -t 30
```

### Uptime Kuma (recommended self-hosted):
- Type: HTTP(s)
- URL: `http://<host>:5000/api/health`
- Keyword: `"status":"ok"`
- Interval: 60 seconds
- Retry: 3 times before alerting

---

## 3. Service Level Objectives (SLOs)

| SLO | Target | Measurement |
|-----|--------|-------------|
| Availability | ≥ 99.5% monthly | Uptime Kuma / Nagios |
| API Latency P95 | ≤ 500ms | `X-Latency` header / Latency Gauge card |
| API Latency P99 | ≤ 1000ms | Stress test output |
| Error Rate | < 0.1% | AuditLog `status_code >= 500` count |
| DB Connection | Healthy | `/api/health/detailed` → `mongo_status` |
| AI Engine | Healthy or degraded | `/api/health/detailed` → `groq_status` |

---

## 4. Latency Monitoring (Phase 4.7)

The `latencyMiddleware` records every request duration and:
- Appends `X-Latency: <ms>ms` header to every API response
- Emits `latency:update` via Socket.IO every 10 requests
- The Dashboard **API Latency Gauge** card displays rolling avg + P95

**Verify via curl:**
```bash
curl -I http://localhost:5000/api/health
# Look for: X-Latency: 12ms
```

---

## 5. Log Monitoring

### AuditLog error rate query (MongoDB shell):
```javascript
// Count 5xx responses in the last hour
db.auditlogs.countDocuments({
  status_code: { $gte: 500 },
  timestamp: { $gte: new Date(Date.now() - 3600000) }
})
```

### Backend log tailing (Docker):
```bash
docker logs ciphernest-backend --follow --tail=100
```

### Key log patterns to alert on:
| Pattern | Severity | Action |
|---------|----------|--------|
| `🔥 UNCAUGHT EXCEPTION` | Critical | Page on-call |
| `🌊 UNHANDLED REJECTION` | High | Investigate within 1h |
| `[CIRCUIT BREAKER] Tripped` | Medium | Check external API status |
| `[LogManager] ❌ Archival job failed` | Medium | Check disk space |
| `⚠️  Groq AI status: Offline` | Low | Check GROQ_API_KEY |

---

## 6. Alerting Recommendations

### Minimum alerting setup:
1. **Uptime alert** — notify if health check fails 3 consecutive times
2. **Error rate alert** — notify if 5xx rate exceeds 1% over 5 minutes
3. **Latency alert** — notify if P95 exceeds 500ms for 10 consecutive minutes
4. **Disk space alert** — notify if backup volume exceeds 80% capacity

### Recommended tools:
- **Self-hosted**: Uptime Kuma + Grafana + Loki
- **Cloud**: Datadog, New Relic, or AWS CloudWatch
- **Minimal**: Cronitor or Better Uptime (SaaS, free tier available)

---

## 7. Smoke Test Checklist (run before every deployment)

```bash
# 1. Health check
curl -s http://localhost:5000/api/health | grep '"status":"ok"'

# 2. Auth flow
TOKEN=$(curl -s -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@test.com","password":"password"}' | \
  node -e "process.stdin.resume();let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>console.log(JSON.parse(d).token))")

# 3. Detailed health (authenticated)
curl -s -H "Authorization: Bearer $TOKEN" http://localhost:5000/api/health/detailed

# 4. Threat feed
curl -s -H "Authorization: Bearer $TOKEN" http://localhost:5000/api/threats/global | \
  node -e "process.stdin.resume();let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>console.log('Threats:',JSON.parse(d).length))"

# 5. Latency header check
curl -I -H "Authorization: Bearer $TOKEN" http://localhost:5000/api/health/detailed | grep X-Latency
```

---

*This document is maintained by the Lead Architect. Review after every infrastructure change.*
