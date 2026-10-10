import { AuthService } from "./auth.js"
import { getDatabase } from "./db.js"
import { verifySocialIdentity } from "./identity.js"
import { createRecoveryMailer } from "./mail.js"
import type { AuthRuntime } from "./http.js"

let runtime: Promise<AuthRuntime> | undefined

export function getAuthRuntime(): Promise<AuthRuntime> {
  runtime ??= (async () => {
    const secret = process.env.AUTH_SECRET || ""
    if (secret.length < 32)
      throw new Error("AUTH_SECRET is missing or too short.")
    return {
      service: new AuthService({
        database: await getDatabase(),
        secret,
        mailer: createRecoveryMailer(),
        verifyIdentity: verifySocialIdentity,
      }),
      secureCookies:
        process.env.VERCEL === "1" || process.env.NODE_ENV === "production",
    }
  })().catch((error) => {
    runtime = undefined
    throw error
  })
  return runtime
}
