import nodemailer from "nodemailer"
import { renderRecoveryEmail } from "./recovery-email.js"

export interface RecoveryEmail {
  email: string
  code: string
  token: string
  cancelToken: string
  location?: string
  device?: string
  ip?: string
  requestedAt?: string
}

export interface RecoveryMailer {
  assertConfigured(): void
  send(message: RecoveryEmail): Promise<void>
}

export function smtpOptions() {
  const port = Number(process.env.BREVO_SMTP_PORT || "587")
  if (![465, 587, 2525].includes(port))
    throw new Error("Unsupported Brevo SMTP port.")
  return {
    host: "smtp-relay.brevo.com",
    port,
    secure: port === 465,
    requireTLS: port !== 465,
    auth: {
      user: process.env.BREVO_SMTP_USER!,
      pass: process.env.BREVO_SMTP_PASSWORD!,
    },
    tls: { minVersion: "TLSv1.2" as const, rejectUnauthorized: true },
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 15000,
    disableFileAccess: true,
    disableUrlAccess: true,
  }
}

export function createRecoveryMailer(): RecoveryMailer {
  const assertConfigured = () => {
    if (
      !process.env.BREVO_SMTP_USER ||
      !process.env.BREVO_SMTP_PASSWORD ||
      !process.env.BREVO_FROM_EMAIL ||
      !process.env.APP_URL
    ) {
      throw new Error("Brevo SMTP credentials, sender, or APP_URL are missing.")
    }
    const url = new URL(process.env.APP_URL)
    const local = ["localhost", "127.0.0.1"].includes(url.hostname)
    if (
      url.username ||
      url.password ||
      (url.protocol !== "https:" &&
        !(url.protocol === "http:" && local && !process.env.VERCEL))
    ) {
      throw new Error("APP_URL must be a trusted HTTPS application URL.")
    }
    if (
      !/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(process.env.BREVO_FROM_EMAIL)
    ) {
      throw new Error("The Brevo sender must be an email address.")
    }
  }

  return {
    assertConfigured,
    async send(message) {
      assertConfigured()
      const { text, html } = renderRecoveryEmail(message, process.env.APP_URL!)
      const transport = nodemailer.createTransport(smtpOptions())
      try {
        const result = await transport.sendMail({
          from: {
            name: process.env.BREVO_FROM_NAME || "Flux",
            address: process.env.BREVO_FROM_EMAIL!,
          },
          to: { address: message.email, name: "" },
          subject: "Reset your Flux password",
          text,
          html,
        })
        if (!result.accepted?.length)
          throw new Error("SMTP did not accept the recipient.")
      } finally {
        transport.close()
      }
    },
  }
}
