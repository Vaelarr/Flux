import nodemailer from "nodemailer"

export interface RecoveryEmail {
  email: string
  code: string
  token: string
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
    async send({ email, code, token, location, device, ip, requestedAt }) {
      assertConfigured()
      const link = new URL("/reset-password", process.env.APP_URL)
      // A URL fragment keeps the secret out of server request logs and referrers.
      link.hash = "token=" + token
      const transport = nodemailer.createTransport(smtpOptions())

      const locationText = location || "Unknown location"
      const deviceText = device || "Unknown device"
      const ipText = ip ? ` (${ip})` : ""
      const timeText = requestedAt || new Date().toUTCString()

      try {
        const result = await transport.sendMail({
          from: {
            name: process.env.BREVO_FROM_NAME || "Flux",
            address: process.env.BREVO_FROM_EMAIL!,
          },
          to: { address: email, name: "" },
          subject: "Reset your Flux password",
          text:
            `Reset your Flux password: ${link.href}\n\n` +
            `Or enter this 6-digit code: ${code}\n\n` +
            `Request Details:\n` +
            `• Machine Location: ${locationText}\n` +
            `• Device: ${deviceText}${ipText}\n` +
            `• Time: ${timeText}\n\n` +
            `The link and code expire in 15 minutes. Never share this code. If you did not request a reset, ignore this email.`,
          html:
            `<div style="background-color: #FBF5DD; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; padding: 36px 16px; color: #0D530E;">` +
            `<div style="max-width: 520px; margin: 0 auto; background-color: #ffffff; border: 1px solid #E7E1B1; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 14px rgba(13,83,14,0.06);">` +
            `<div style="padding: 28px 32px; background-color: #FAF7EE; border-bottom: 1px solid #E7E1B1;">` +
            `<h1 style="margin: 0; font-family: Georgia, serif; font-size: 24px; color: #0D530E; font-weight: bold;">Flux</h1>` +
            `<p style="margin: 4px 0 0 0; font-size: 13px; color: #526747;">Password Recovery Request</p>` +
            `</div>` +
            `<div style="padding: 32px;">` +
            `<h2 style="margin: 0 0 12px 0; font-family: Georgia, serif; font-size: 20px; color: #0D530E;">Reset your password</h2>` +
            `<p style="margin: 0 0 24px 0; font-size: 14px; line-height: 1.5; color: #526747;">` +
            `We received a request to reset your password. Use the verification code below or click the reset button.` +
            `</p>` +
            `<div style="text-align: center; margin: 24px 0;">` +
            `<div style="display: inline-block; background-color: #FAF7EE; border: 2px dashed #306D29; border-radius: 8px; padding: 12px 28px; font-family: monospace, monospace; font-size: 28px; font-weight: bold; letter-spacing: 5px; color: #0D530E;">` +
            `${code}` +
            `</div>` +
            `</div>` +
            `<div style="text-align: center; margin: 24px 0;">` +
            `<a href="${link.href}" style="display: inline-block; background-color: #0D530E; color: #FBF5DD; text-decoration: none; padding: 12px 28px; font-size: 14px; font-weight: 600; border-radius: 6px;">` +
            `Reset Password` +
            `</a>` +
            `</div>` +
            `<div style="margin-top: 28px; padding: 16px 20px; background-color: #FAF7EE; border: 1px solid #E7E1B1; border-radius: 8px;">` +
            `<p style="margin: 0 0 10px 0; font-size: 12px; font-weight: 700; color: #0D530E; text-transform: uppercase; letter-spacing: 0.5px;">` +
            `📍 Request Machine & Location Details` +
            `</p>` +
            `<table style="width: 100%; border-collapse: collapse; font-size: 13px; color: #526747;">` +
            `<tr><td style="padding: 4px 0; width: 110px; font-weight: 600; color: #0D530E;">Location:</td><td style="padding: 4px 0; font-weight: 500; color: #0D530E;">${locationText}</td></tr>` +
            `<tr><td style="padding: 4px 0; font-weight: 600; color: #0D530E;">Device:</td><td style="padding: 4px 0;">${deviceText}</td></tr>` +
            (ip
              ? `<tr><td style="padding: 4px 0; font-weight: 600; color: #0D530E;">IP Address:</td><td style="padding: 4px 0; font-family: monospace;">${ip}</td></tr>`
              : "") +
            `<tr><td style="padding: 4px 0; font-weight: 600; color: #0D530E;">Time:</td><td style="padding: 4px 0;">${timeText}</td></tr>` +
            `</table>` +
            `</div>` +
            `<p style="margin: 20px 0 0 0; font-size: 12px; line-height: 1.5; color: #8a7e50;">` +
            `The link and code expire in 15 minutes. Never share this code. If you did not request this, you can safely ignore this email.` +
            `</p>` +
            `</div>` +
            `<div style="padding: 16px 32px; border-top: 1px solid #E7E1B1; background-color: #FAF7EE; text-align: center; font-size: 11px; color: #8a7e50;">` +
            `© 2026 Flux, Inc.` +
            `</div>` +
            `</div>` +
            `</div>`,
        })
        if (!result.accepted?.length)
          throw new Error("SMTP did not accept the recipient.")
      } finally {
        transport.close()
      }
    },
  }
}
