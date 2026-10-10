import type { RecoveryEmail } from "./mail.js"

function escapeHtml(value: string) {
  return value.replace(
    /[&<>"']/g,
    (character) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      })[character]!,
  )
}

export function renderRecoveryEmail(message: RecoveryEmail, appUrl: string) {
  const { code, token, cancelToken, location, device, ip, requestedAt } =
    message
  const resetLink = new URL("/reset-password", appUrl)
  const cancelLink = new URL("/reset-password/cancel", appUrl)
  const securityLink = new URL("/profile?tab=security", appUrl)
  // Fragments keep both capabilities out of HTTP request URLs and referrers.
  resetLink.hash = new URLSearchParams({ token }).toString()
  cancelLink.hash = new URLSearchParams({ token: cancelToken }).toString()

  const locationText = location || "Unknown location"
  const deviceText = device || "Unknown device"
  const timeText = requestedAt || new Date().toUTCString()
  const text =
    `Reset your Flux password: ${resetLink.href}\n\n` +
    `Or enter this 6-digit code: ${code}\n\n` +
    `Request details:\n` +
    `- Location: ${locationText}\n` +
    `- Device: ${deviceText}${ip ? ` (${ip})` : ""}\n` +
    `- Time: ${timeText}\n\n` +
    `The link and code expire in 15 minutes. Never share them.\n\n` +
    `Didn't request this? Cancel this reset request: ${cancelLink.href}\n` +
    `Open the link and confirm cancellation to disable this request's code and reset link. ` +
    `The cancellation link also expires in 15 minutes. A request alone does not change your password.\n\n` +
    `If you suspect someone has access to your account, sign in to review your devices, ` +
    `sign out unfamiliar sessions, and change your password: ${securityLink.href}`

  const html =
    `<div style="background-color: #FBF5DD; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; padding: 36px 16px; color: #0D530E;">` +
    `<div style="max-width: 520px; margin: 0 auto; background-color: #ffffff; border: 1px solid #E7E1B1; border-radius: 12px; overflow: hidden;">` +
    `<div style="padding: 28px 32px; background-color: #FAF7EE; border-bottom: 1px solid #E7E1B1;">` +
    `<h1 style="margin: 0; font-family: Georgia, serif; font-size: 24px; color: #0D530E;">Flux</h1>` +
    `<p style="margin: 4px 0 0; font-size: 13px; color: #526747;">Password Recovery Request</p>` +
    `</div>` +
    `<div style="padding: 32px;">` +
    `<h2 style="margin: 0 0 12px; font-family: Georgia, serif; font-size: 20px; color: #0D530E;">Reset your password</h2>` +
    `<p style="margin: 0 0 24px; font-size: 14px; line-height: 1.5; color: #526747;">` +
    `We received a request to reset your password. Use the verification code below or click the reset button.` +
    `</p>` +
    `<div style="text-align: center; margin: 24px 0;">` +
    `<div style="display: inline-block; background-color: #FAF7EE; border: 2px dashed #306D29; border-radius: 8px; padding: 12px 28px; font-family: monospace; font-size: 28px; font-weight: bold; letter-spacing: 5px; color: #0D530E;">` +
    `${escapeHtml(code)}</div></div>` +
    `<div style="text-align: center; margin: 24px 0;">` +
    `<a href="${escapeHtml(resetLink.href)}" style="display: inline-block; background-color: #0D530E; color: #FBF5DD; text-decoration: none; padding: 12px 28px; font-size: 14px; font-weight: 600; border-radius: 6px;">Reset Password</a>` +
    `</div>` +
    `<div style="margin-top: 28px; padding: 16px 20px; background-color: #FAF7EE; border: 1px solid #E7E1B1; border-radius: 8px;">` +
    `<p style="margin: 0 0 10px; font-size: 12px; font-weight: 700; color: #0D530E; text-transform: uppercase; letter-spacing: 0.5px;">Request details</p>` +
    `<table style="width: 100%; border-collapse: collapse; font-size: 13px; color: #526747;">` +
    `<tr><td style="padding: 4px 0; width: 110px; font-weight: 600; color: #0D530E;">Location:</td><td style="padding: 4px 0;">${escapeHtml(locationText)}</td></tr>` +
    `<tr><td style="padding: 4px 0; font-weight: 600; color: #0D530E;">Device:</td><td style="padding: 4px 0;">${escapeHtml(deviceText)}</td></tr>` +
    (ip
      ? `<tr><td style="padding: 4px 0; font-weight: 600; color: #0D530E;">IP Address:</td><td style="padding: 4px 0; font-family: monospace;">${escapeHtml(ip)}</td></tr>`
      : "") +
    `<tr><td style="padding: 4px 0; font-weight: 600; color: #0D530E;">Time:</td><td style="padding: 4px 0;">${escapeHtml(timeText)}</td></tr>` +
    `</table></div>` +
    `<p style="margin: 20px 0 0; font-size: 12px; line-height: 1.5; color: #8a7e50;">The link and code expire in 15 minutes. Never share them.</p>` +
    `<div style="margin-top: 24px; padding: 20px; background-color: #FFF8ED; border: 1px solid #EAD4AE; border-radius: 8px;">` +
    `<h3 style="margin: 0 0 10px; font-size: 16px; color: #704D20;">Didn't request this?</h3>` +
    `<p style="margin: 0 0 16px; font-size: 13px; line-height: 1.6; color: #704D20;">Cancel this request to disable its verification code and reset link. A request alone does not change your password.</p>` +
    `<a href="${escapeHtml(cancelLink.href)}" style="display: inline-block; background-color: #704D20; color: #ffffff; text-decoration: none; padding: 12px 16px; font-size: 13px; font-weight: 600; border-radius: 6px;">This wasn't me — cancel request</a>` +
    `<p style="margin: 12px 0 0; font-size: 12px; line-height: 1.6; color: #704D20;">You'll confirm on the next page. This link also expires in 15 minutes.</p>` +
    `<p style="margin: 16px 0 0; font-size: 13px; line-height: 1.6; color: #704D20;">Concerned about your account? <a href="${escapeHtml(securityLink.href)}" style="color: #0D530E; font-weight: 600;">Review account security</a> to change your password and sign out unfamiliar devices.</p>` +
    `</div></div>` +
    `<div style="padding: 16px 32px; border-top: 1px solid #E7E1B1; background-color: #FAF7EE; text-align: center; font-size: 11px; color: #8a7e50;">© 2026 Flux, Inc.</div>` +
    `</div></div>`

  return { text, html }
}
