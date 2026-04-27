# CipherNest — Backup & Disaster Recovery Procedures
> See also: `COMPLIANCE_AUDIT_CHECKLIST.md` for go-live sign-off requirements.

---

## 1. Primary Backup Command

Run this manually or from a cron job on the host machine:

```bash
mongodump \
  --uri="mongodb://127.0.0.1:27017/ciphernest" \
  --archive=/backups/ciphernest_$(date +%Y%m%d_%H%M%S).gz \
  --gzip
```

**Inside Docker** (targeting the running container):
```bash
docker exec ciphernest-mongodb \
  mongodump \
  --uri="mongodb://localhost:27017/ciphernest" \
  --archive=/tmp/db_backup.gz \
  --gzip

# Copy archive out of container
docker cp ciphernest-mongodb:/tmp/db_backup.gz ./backups/db_backup_$(date +%Y%m%d).gz
```

---

## 2. Daily Automated Cron Job

Add to the host machine's crontab (`crontab -e`):

```cron
# CipherNest — daily MongoDB backup at 02:00 UTC
0 2 * * * docker exec ciphernest-mongodb mongodump \
  --uri="mongodb://localhost:27017/ciphernest" \
  --archive=/tmp/db_backup.gz --gzip && \
  docker cp ciphernest-mongodb:/tmp/db_backup.gz \
  /backups/ciphernest_$(date +\%Y\%m\%d).gz
```

**Retention policy (recommended):**
- Keep daily backups for 7 days
- Keep weekly backups for 4 weeks
- Keep monthly backups for 12 months

Automate retention cleanup:
```bash
# Delete backups older than 7 days
find /backups -name "ciphernest_*.gz" -mtime +7 -delete
```

---

## 3. Restore Procedure

### From host (local MongoDB):
```bash
mongorestore \
  --uri="mongodb://127.0.0.1:27017/ciphernest" \
  --archive=./backups/db_backup.gz \
  --gzip \
  --drop
```

### Into running Docker container:
```bash
# Copy backup into container
docker cp ./backups/db_backup.gz ciphernest-mongodb:/tmp/db_backup.gz

# Restore (--drop clears existing data first)
docker exec ciphernest-mongodb \
  mongorestore \
  --uri="mongodb://localhost:27017/ciphernest" \
  --archive=/tmp/db_backup.gz \
  --gzip \
  --drop
```

### Verification after restore:
```bash
docker exec ciphernest-mongodb \
  mongosh ciphernest --eval "db.getCollectionNames()"
# Expected: ['auditlogs', 'users', 'alerts', 'toolresults', ...]
```

---

## 4. Disaster Recovery Runbook

### Scenario A — Database corruption
1. Stop backend: `docker compose stop backend`
2. Restore from latest backup (see §3)
3. Restart: `docker compose start backend`
4. Verify: `curl http://localhost:5000/api/health`

### Scenario B — Full host failure
1. Provision new host with Docker + Docker Compose
2. Clone repository: `git clone <repo>`
3. Copy `.env` from secure vault (1Password / AWS Secrets Manager)
4. Copy latest backup archive to `./backups/`
5. Start stack: `docker compose up -d`
6. Restore DB (see §3)
7. Verify all services: `docker compose ps` + health check

### Scenario C — Compromised JWT_SECRET
1. Rotate `JWT_SECRET` in `.env` immediately
2. Restart backend: `docker compose restart backend`
3. All existing sessions are invalidated — users must re-login
4. Audit `AuditLog` collection for suspicious activity in the compromise window

---

## 5. RTO / RPO Targets

| Metric | Target |
|--------|--------|
| Recovery Time Objective (RTO) | < 30 minutes |
| Recovery Point Objective (RPO) | < 24 hours (daily backup) |
| Backup verification frequency | Weekly restore test |

---

## 6. Backup Storage Recommendations

- **Local**: `/backups/` on host with RAID or LVM
- **Off-site**: AWS S3 (`aws s3 cp db_backup.gz s3://ciphernest-backups/`)
- **Encryption**: Encrypt archives before off-site transfer (`gpg --symmetric`)
- **Access control**: Backup bucket should be private, no public access

---

*This document is maintained by the Lead Architect. Review after every infrastructure change.*
