import { isSmtpConfigured } from "@kaneo/email";
import { sql } from "drizzle-orm";
import db from "../../database";
import { getRedisPub, isRedisConfigured } from "../../redis";
import { readAppVersion } from "../system/app-version";
import { safeErrorCode, withTimeout } from "../system/with-timeout";

type ServiceStatus = "ok" | "down" | "not_configured";

const PROBE_TIMEOUT_MS = 3_000;

async function probeDatabase() {
  const started = performance.now();
  try {
    await withTimeout(() => db.execute(sql`select 1`), PROBE_TIMEOUT_MS);
    const latencyMs = Math.round(performance.now() - started);
    let migrationsApplied: number | null = null;
    let lastMigrationAt: string | null = null;
    try {
      const result = await withTimeout(
        () =>
          db.execute<{ applied: number; last: string | null }>(
            sql`select count(*)::int as applied, max(created_at)::text as last from drizzle.__drizzle_migrations`,
          ),
        PROBE_TIMEOUT_MS,
      );
      const row = result.rows[0];
      migrationsApplied = row?.applied ?? null;
      lastMigrationAt =
        row?.last && Number.isFinite(Number(row.last))
          ? new Date(Number(row.last)).toISOString()
          : null;
    } catch {
      // Migration metadata is optional; connectivity was already checked.
    }
    return {
      status: "ok" as ServiceStatus,
      latencyMs,
      migrationsApplied,
      lastMigrationAt,
      errorCode: null,
    };
  } catch (error) {
    return {
      status: "down" as ServiceStatus,
      latencyMs: null,
      migrationsApplied: null,
      lastMigrationAt: null,
      errorCode: safeErrorCode(error),
    };
  }
}

// Redis only fans realtime events out across API instances, so a single
// instance without it is healthy.
async function probeRedis() {
  if (!isRedisConfigured()) {
    return { status: "not_configured" as ServiceStatus, errorCode: null };
  }
  try {
    await withTimeout(() => getRedisPub().ping(), PROBE_TIMEOUT_MS);
    return { status: "ok" as ServiceStatus, errorCode: null };
  } catch (error) {
    return { status: "down" as ServiceStatus, errorCode: safeErrorCode(error) };
  }
}

function describeStorage() {
  const s3Configured = [
    "S3_ENDPOINT",
    "S3_BUCKET",
    "S3_ACCESS_KEY_ID",
    "S3_SECRET_ACCESS_KEY",
  ].every((name) => Boolean(process.env[name]?.trim()));
  return {
    // Documents use the filesystem driver; task images use S3 when set up.
    documentDriver: process.env.STORAGE_DRIVER ?? "fs",
    s3Configured,
  };
}

/** Instance health for the admin System page. No credentials are returned. */
async function getSystemStatus() {
  const [database, redis] = await Promise.all([probeDatabase(), probeRedis()]);
  return {
    version: readAppVersion(),
    nodeVersion: process.version,
    uptimeSeconds: Math.round(process.uptime()),
    database,
    redis,
    email: {
      configured: isSmtpConfigured(),
      host: isSmtpConfigured() ? (process.env.SMTP_HOST ?? null) : null,
    },
    storage: describeStorage(),
  };
}

export default getSystemStatus;
