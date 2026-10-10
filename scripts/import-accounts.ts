import { readFile } from "node:fs/promises"
import { randomUUID } from "node:crypto"
import { normalizedEmail } from "../server/auth.js"
import { hashPassword } from "../server/crypto.js"
import { getDatabase } from "../server/db.js"

// Only use a trusted administrator export. Browser caches are not identity proof.
const exportPath = process.argv[2]
const apply = process.argv.includes("--apply")
if (!exportPath || exportPath.startsWith("--")) {
  console.error("Usage: npm run db:import -- <trusted-export.json> [--apply]")
  process.exitCode = 1
} else {
  try {
    const records: unknown = JSON.parse(await readFile(exportPath, "utf8"))
    if (!Array.isArray(records))
      throw new Error("Export must contain an array of account objects.")
    const accounts = records.map((record: unknown, index: number) => {
      if (!record || typeof record !== "object")
        throw new Error("Invalid account at index " + index + ".")
      const value = record as Record<string, unknown>
      const email = normalizedEmail(value.email)
      const name = typeof value.name === "string" ? value.name.trim() : ""
      if (name.length < 2 || name.length > 100)
        throw new Error("Invalid name at index " + index + ".")
      const provider =
        value.provider === "google" || value.provider === "apple"
          ? value.provider
          : "password"
      const uid =
        typeof value.firebaseUid === "string" && value.firebaseUid
          ? value.firebaseUid
          : null
      const password =
        typeof value.password === "string" && value.password.length <= 1024
          ? value.password
          : null
      if (
        (!password && provider === "password") ||
        (provider !== "password" && !uid)
      ) {
        throw new Error("Missing trusted credential at index " + index + ".")
      }
      const createdAt =
        typeof value.createdAt === "string"
          ? Date.parse(value.createdAt)
          : Date.now()
      if (!Number.isFinite(createdAt))
        throw new Error("Invalid creation date at index " + index + ".")
      return { email, name, provider, uid, password, createdAt }
    })
    if (!apply) {
      console.log(
        accounts.length +
          " accounts validated. Add --apply to import; existing accounts will be skipped.",
      )
    } else {
      const database = await getDatabase()
      let inserted = 0
      try {
        for (const account of accounts) {
          const encoded = account.password
            ? await hashPassword(account.password)
            : null
          const result = await database.execute({
            sql: "INSERT INTO flux_accounts (id, name, email, password_hash, provider, firebase_uid, created_at) VALUES (?, ?, ?, ?, ?, ?, ?) ON CONFLICT DO NOTHING",
            args: [
              randomUUID(),
              account.name,
              account.email,
              encoded,
              account.provider,
              account.uid,
              account.createdAt,
            ],
          })
          inserted += result.rowsAffected
        }
        console.log(
          inserted +
            " accounts imported; " +
            (accounts.length - inserted) +
            " existing accounts skipped.",
        )
      } finally {
        database.close()
      }
    }
  } catch (error) {
    // Do not dump export contents or credentials into logs.
    console.error(
      "Account import failed: " +
        (error instanceof SyntaxError
          ? "Invalid JSON."
          : error instanceof Error
            ? error.message
            : "Check the export and database configuration."),
    )
    process.exitCode = 1
  }
}
