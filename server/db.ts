import { createClient, type Client } from "@libsql/client"

export const SCHEMA = [
  "CREATE TABLE IF NOT EXISTS flux_accounts (id TEXT PRIMARY KEY, name TEXT NOT NULL, email TEXT NOT NULL UNIQUE COLLATE NOCASE, phone_number TEXT, password_hash TEXT, provider TEXT NOT NULL DEFAULT 'password', firebase_uid TEXT UNIQUE, avatar_url TEXT, bio TEXT, created_at INTEGER NOT NULL, last_password_reset INTEGER)",
  "CREATE TABLE IF NOT EXISTS flux_sessions (token_hash TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES flux_accounts(id) ON DELETE CASCADE, user_agent TEXT NOT NULL, created_at INTEGER NOT NULL, expires_at INTEGER NOT NULL)",
  "CREATE INDEX IF NOT EXISTS flux_sessions_user ON flux_sessions(user_id)",
  "CREATE INDEX IF NOT EXISTS flux_sessions_expiry ON flux_sessions(expires_at)",
  "CREATE TABLE IF NOT EXISTS flux_password_resets (user_id TEXT PRIMARY KEY REFERENCES flux_accounts(id) ON DELETE CASCADE, code_hash TEXT NOT NULL, token_hash TEXT NOT NULL UNIQUE, expires_at INTEGER NOT NULL, attempts INTEGER NOT NULL DEFAULT 0, grant_hash TEXT UNIQUE, consumed_at INTEGER)",
  "CREATE TABLE IF NOT EXISTS flux_rate_limits (key TEXT PRIMARY KEY, window_start INTEGER NOT NULL, count INTEGER NOT NULL)",
  "CREATE INDEX IF NOT EXISTS flux_rate_window ON flux_rate_limits(window_start)",
]

export async function initializeDatabase(database: Client) {
  await database.execute("PRAGMA foreign_keys = ON")
  await database.batch(SCHEMA, "write")
  // Check and alter under one write transaction so concurrent cold starts cannot race.
  const migration = await database.transaction("write")
  try {
    const columns = await migration.execute("PRAGMA table_info(flux_accounts)")
    if (!columns.rows.some((column) => column.name === "phone_number")) {
      await migration.execute(
        "ALTER TABLE flux_accounts ADD COLUMN phone_number TEXT",
      )
    }
    if (!columns.rows.some((column) => column.name === "bio")) {
      await migration.execute("ALTER TABLE flux_accounts ADD COLUMN bio TEXT")
    }
    await migration.commit()
  } finally {
    migration.close()
  }
  await database.batch(
    [
      {
        sql: "DELETE FROM flux_sessions WHERE expires_at <= ?",
        args: [Date.now()],
      },
      {
        sql: "DELETE FROM flux_password_resets WHERE expires_at <= ?",
        args: [Date.now()],
      },
      {
        sql: "DELETE FROM flux_rate_limits WHERE window_start < ?",
        args: [Date.now() - 24 * 60 * 60 * 1000],
      },
    ],
    "write",
  )
}

let database: Client | undefined
let ready: Promise<Client> | undefined

export function getDatabase(): Promise<Client> {
  if (!ready) {
    const url = process.env.TURSO_DATABASE_URL
    const authToken = process.env.TURSO_AUTH_TOKEN
    if (!url || (!url.startsWith("file:") && !authToken)) {
      throw new Error("Turso server credentials are missing.")
    }
    if (
      process.env.VERCEL &&
      !url.startsWith("libsql://") &&
      !url.startsWith("https://")
    ) {
      throw new Error("Vercel requires a remote Turso database.")
    }
    database ??= createClient({ url, authToken })
    ready = initializeDatabase(database)
      .then(() => database!)
      .catch((error) => {
        ready = undefined
        throw error
      })
  }
  return ready
}
