import nodemailer from "nodemailer"
import { getDatabase } from "../server/db.js"
import { createRecoveryMailer, smtpOptions } from "../server/mail.js"

const required = [
  "TURSO_DATABASE_URL",
  "TURSO_AUTH_TOKEN",
  "AUTH_SECRET",
  "APP_URL",
  "BREVO_SMTP_USER",
  "BREVO_SMTP_PASSWORD",
  "BREVO_FROM_EMAIL",
]
const missing = required.filter((name) => !process.env[name])
if (missing.length) {
  console.error("Missing environment variables: " + missing.join(", "))
  process.exitCode = 1
} else if (process.env.AUTH_SECRET!.length < 32) {
  console.error("AUTH_SECRET must contain at least 32 characters.")
  process.exitCode = 1
} else {
  const checks = await Promise.allSettled([
    (async () => {
      const database = await getDatabase()
      try {
        await database.execute("SELECT 1")
        console.log("Turso: connected; Flux tables are ready.")
      } finally {
        database.close()
      }
    })(),
    (async () => {
      createRecoveryMailer().assertConfigured()
      const transport = nodemailer.createTransport(smtpOptions())
      try {
        await transport.verify()
        console.log(
          "Brevo: TLS connection and SMTP login verified. No email was sent.",
        )
      } finally {
        transport.close()
      }
    })(),
  ])
  checks.forEach((result, index) => {
    if (result.status === "rejected") {
      console.error(
        (index === 0 ? "Turso" : "Brevo") +
          ": check failed (" +
          String(result.reason?.code || "configuration or connection error") +
          ").",
      )
      process.exitCode = 1
    }
  })
}
