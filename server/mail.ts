import nodemailer from "nodemailer";

export interface RecoveryEmail {
  email: string;
  code: string;
  token: string;
}

export interface RecoveryMailer {
  assertConfigured(): void;
  send(message: RecoveryEmail): Promise<void>;
}

export function smtpOptions() {
  const port = Number(process.env.BREVO_SMTP_PORT || "587");
  if (![465, 587, 2525].includes(port)) throw new Error("Unsupported Brevo SMTP port.");
  return {
    host: "smtp-relay.brevo.com",
    port,
    secure: port === 465,
    requireTLS: port !== 465,
    auth: { user: process.env.BREVO_SMTP_USER!, pass: process.env.BREVO_SMTP_PASSWORD! },
    tls: { minVersion: "TLSv1.2" as const, rejectUnauthorized: true },
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 15000,
    disableFileAccess: true,
    disableUrlAccess: true,
  };
}

export function createRecoveryMailer(): RecoveryMailer {
  const assertConfigured = () => {
    if (!process.env.BREVO_SMTP_USER || !process.env.BREVO_SMTP_PASSWORD ||
        !process.env.BREVO_FROM_EMAIL || !process.env.APP_URL) {
      throw new Error("Brevo SMTP credentials, sender, or APP_URL are missing.");
    }
    const url = new URL(process.env.APP_URL);
    const local = ["localhost", "127.0.0.1"].includes(url.hostname);
    if (url.username || url.password || (url.protocol !== "https:" && !(url.protocol === "http:" && local && !process.env.VERCEL))) {
      throw new Error("APP_URL must be a trusted HTTPS application URL.");
    }
    if (!/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(process.env.BREVO_FROM_EMAIL)) {
      throw new Error("The Brevo sender must be an email address.");
    }
  };

  return {
    assertConfigured,
    async send({ email, code, token }) {
      assertConfigured();
      const link = new URL("/reset-password", process.env.APP_URL);
      // A URL fragment keeps the secret out of server request logs and referrers.
      link.hash = "token=" + token;
      const transport = nodemailer.createTransport(smtpOptions());
      try {
        const result = await transport.sendMail({
          from: { name: process.env.BREVO_FROM_NAME || "Flux", address: process.env.BREVO_FROM_EMAIL! },
          to: { address: email, name: "" },
          subject: "Reset your Flux password",
          text: "Reset your Flux password: " + link.href + "\n\nOr enter this code: " + code +
            "\n\nThe link and code expire in 15 minutes. Never share this code. If you did not request a reset, ignore this email.",
          html: '<h1>Reset your Flux password</h1><p><a href="' + link.href +
            '">Reset password</a></p><p>Or enter this code: <strong>' + code +
            '</strong></p><p>The link and code expire in 15 minutes. Never share this code.</p><p>Did not request a reset? Ignore this email.</p>',
        });
        if (!result.accepted?.length) throw new Error("SMTP did not accept the recipient.");
      } finally {
        transport.close();
      }
    },
  };
}
