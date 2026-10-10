import type { IncomingMessage, ServerResponse } from "node:http"
import { AuthError, type AuthContext, type AuthService } from "./auth.js"

export interface AuthRuntime {
  service: AuthService
  secureCookies: boolean
}
type Factory = () => Promise<AuthRuntime>

function cookieValue(request: IncomingMessage, name: string) {
  for (const part of (request.headers.cookie || "").split(";")) {
    const separator = part.indexOf("=")
    if (part.slice(0, separator).trim() === name) {
      try {
        return decodeURIComponent(part.slice(separator + 1))
      } catch {
        return undefined
      }
    }
  }
  return undefined
}

function cookie(name: string, value: string, secure: boolean, maxAge?: number) {
  return (
    name +
    "=" +
    encodeURIComponent(value) +
    "; Path=/; HttpOnly; SameSite=Lax" +
    (secure ? "; Secure" : "") +
    (maxAge !== undefined ? "; Max-Age=" + maxAge : "")
  )
}

async function readBody(
  request: IncomingMessage & { body?: unknown },
): Promise<Record<string, unknown>> {
  if (
    !request.headers["content-type"]
      ?.toLowerCase()
      .startsWith("application/json")
  ) {
    throw new AuthError(415, "Use application/json.")
  }
  if (Number(request.headers["content-length"] || 0) > 16384)
    throw new AuthError(413, "Request is too large.")
  let value: unknown = request.body
  if (value === undefined) {
    const chunks: Buffer[] = []
    let length = 0
    for await (const chunk of request) {
      const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)
      length += bytes.length
      if (length > 16384) throw new AuthError(413, "Request is too large.")
      chunks.push(bytes)
    }
    value = Buffer.concat(chunks).toString("utf8")
  }
  try {
    if (typeof value === "string") {
      if (Buffer.byteLength(value) > 16384)
        throw new AuthError(413, "Request is too large.")
      value = JSON.parse(value)
    }
  } catch (error) {
    if (error instanceof AuthError) throw error
    throw new AuthError(400, "Invalid request.")
  }
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new AuthError(400, "Invalid request.")
  return value as Record<string, unknown>
}

const POST_ACTIONS = new Set([
  "register",
  "login",
  "logout",
  "social",
  "reset-request",
  "reset-verify",
  "reset-complete",
])

export function createAuthHandler(factory: Factory) {
  return async function handler(
    request: IncomingMessage & { body?: unknown },
    response: ServerResponse,
  ) {
    response.setHeader("Content-Type", "application/json; charset=utf-8")
    response.setHeader("Cache-Control", "no-store")
    response.setHeader("X-Content-Type-Options", "nosniff")
    response.setHeader("Referrer-Policy", "no-referrer")
    const action =
      new URL(request.url || "/", "http://localhost").pathname
        .split("/")
        .pop() || ""
    const send = (status: number, data: unknown) => {
      response.statusCode = status
      response.end(JSON.stringify(data))
    }

    try {
      if (action !== "session" && !POST_ACTIONS.has(action))
        throw new AuthError(404, "Endpoint not found.")
      const expected = action === "session" ? "GET" : "POST"
      if (request.method !== expected) {
        response.setHeader("Allow", expected)
        throw new AuthError(405, "Method not allowed.")
      }
      const origin = request.headers.origin
      if (request.method === "POST" && origin) {
        let parsed: URL
        try {
          parsed = new URL(origin)
        } catch {
          throw new AuthError(403, "Request origin is not allowed.")
        }
        if (
          parsed.host !== request.headers.host ||
          !["http:", "https:"].includes(parsed.protocol)
        ) {
          throw new AuthError(403, "Request origin is not allowed.")
        }
      }
      const body = request.method === "POST" ? await readBody(request) : {}
      const { service, secureCookies } = await factory()
      if (secureCookies && origin && !origin.startsWith("https://"))
        throw new AuthError(403, "HTTPS is required.")
      const sessionName = secureCookies ? "__Host-flux_session" : "flux_session"
      const grantName = secureCookies ? "__Host-flux_reset" : "flux_reset"
      const forwarded = request.headers["x-forwarded-for"]
      const context: AuthContext = {
        ip:
          process.env.VERCEL && typeof forwarded === "string"
            ? forwarded.split(",")[0].trim()
            : request.socket.remoteAddress || "unknown",
        userAgent: request.headers["user-agent"] || "Unknown browser",
        sessionToken: cookieValue(request, sessionName),
        resetGrant: cookieValue(request, grantName),
      }

      if (action === "register") {
        send(201, await service.register(body, context))
        return
      }
      if (action === "session") {
        send(200, await service.session(context))
        return
      }
      if (action === "login" || action === "social") {
        const { token, maxAge, user } = await service[action](body, context)
        response.setHeader(
          "Set-Cookie",
          cookie(sessionName, token, secureCookies, maxAge),
        )
        send(200, { user })
        return
      }
      if (action === "logout") {
        const result = await service.logout(context)
        response.setHeader("Set-Cookie", [
          cookie(sessionName, "", secureCookies, 0),
          cookie(grantName, "", secureCookies, 0),
        ])
        send(200, result)
        return
      }
      if (action === "reset-request") {
        send(200, await service.requestReset(body, context))
        return
      }
      if (action === "reset-verify") {
        const { grant, ...result } = await service.verifyReset(body, context)
        response.setHeader(
          "Set-Cookie",
          cookie(grantName, grant, secureCookies, result.expiresIn),
        )
        send(200, result)
        return
      }
      const result = await service.completeReset(body, context)
      const cookies = [cookie(grantName, "", secureCookies, 0)]
      if (result.sessionsRevoked)
        cookies.push(cookie(sessionName, "", secureCookies, 0))
      response.setHeader("Set-Cookie", cookies)
      send(200, result)
    } catch (error) {
      if (error instanceof AuthError) {
        if (typeof error.details.retryAfter === "number")
          response.setHeader("Retry-After", error.details.retryAfter)
        send(error.status, { error: error.message, ...error.details })
      } else {
        console.error("Account API failed", {
          action,
          code: (error as { code?: string })?.code || "SERVER_ERROR",
        })
        send(503, {
          error: "Account services are unavailable. Please try again later.",
        })
      }
    }
  }
}
