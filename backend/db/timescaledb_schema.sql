-- ============================================================================
-- CipherNest & BreachBarrier — PostgreSQL + TimescaleDB Time-Series SIEM Schema
-- Optimized for high-velocity firewall logs, threat alerts, and time-bucket aggregates
-- ============================================================================

-- 1. Enable TimescaleDB Extension
CREATE EXTENSION IF NOT EXISTS timescaledb CASCADE;

-- 2. Raw SIEM Event Logs Hypertable
CREATE TABLE IF NOT EXISTS siem_security_logs (
    event_time         TIMESTAMPTZ NOT NULL,
    event_id           UUID DEFAULT gen_random_uuid(),
    topic              VARCHAR(64) NOT NULL,
    partition_id       INT NOT NULL,
    kafka_offset       BIGINT NOT NULL,
    source_ip          INET NOT NULL,
    destination_ip     INET,
    destination_port   INT,
    protocol           VARCHAR(16) DEFAULT 'TCP',
    action             VARCHAR(32) NOT NULL, -- 'ALLOW', 'DROP', 'AUTH_FAILED', 'AUTH_SUCCESS'
    threat_severity    VARCHAR(16) DEFAULT 'INFO', -- 'INFO', 'LOW', 'MEDIUM', 'HIGH', 'CRITICAL'
    username           VARCHAR(64),
    payload_hash       VARCHAR(64),
    raw_metadata       JSONB DEFAULT '{}'::jsonb
);

-- Convert to TimescaleDB Hypertable partitioned by 1-day chunks
SELECT create_hypertable('siem_security_logs', 'event_time', chunk_time_interval => INTERVAL '1 day', if_not_exists => TRUE);

-- Indexes for lightning-fast threat hunting
CREATE INDEX IF NOT EXISTS idx_siem_source_ip_time ON siem_security_logs (source_ip, event_time DESC);
CREATE INDEX IF NOT EXISTS idx_siem_severity_time ON siem_security_logs (threat_severity, event_time DESC);
CREATE INDEX IF NOT EXISTS idx_siem_action_time ON siem_security_logs (action, event_time DESC);

-- 3. Security Threat Anomalies Table
CREATE TABLE IF NOT EXISTS siem_threat_anomalies (
    id                 VARCHAR(64) PRIMARY KEY,
    detected_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    anomaly_type       VARCHAR(64) NOT NULL,
    severity           VARCHAR(16) NOT NULL,
    source_ip          INET NOT NULL,
    target_user        VARCHAR(64),
    incident_details   JSONB NOT NULL,
    recommended_action VARCHAR(64),
    mitigation_status  VARCHAR(32) DEFAULT 'PENDING' -- 'PENDING', 'MITIGATED', 'FALSE_POSITIVE'
);

-- 4. Continuous Aggregate: Hourly Threat Intensity View
CREATE MATERIALIZED VIEW IF NOT EXISTS siem_hourly_threat_summary
WITH (timescaledb.continuous) AS
SELECT
    time_bucket('1 hour', event_time) AS bucket_hour,
    threat_severity,
    COUNT(*) AS total_events,
    COUNT(DISTINCT source_ip) AS unique_attacking_ips
FROM siem_security_logs
GROUP BY bucket_hour, threat_severity
WITH NO DATA;

-- 5. Data Retention & Compression Policy (Ponytail Senior Architecture)
-- Automatically compress logs older than 7 days (reduces disk footprint by 90%)
ALTER TABLE siem_security_logs SET (
    timescaledb.compress,
    timescaledb.compress_segmentby = 'topic, action',
    timescaledb.compress_orderby = 'event_time DESC'
);
SELECT add_compression_policy('siem_security_logs', INTERVAL '7 days', if_not_exists => TRUE);

-- Automatically drop uncompressed chunks older than 90 days
SELECT add_retention_policy('siem_security_logs', INTERVAL '90 days', if_not_exists => TRUE);
