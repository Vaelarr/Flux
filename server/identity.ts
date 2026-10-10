import { createRemoteJWKSet, jwtVerify } from "jose"
import firebaseConfig from "../firebase-applet-config.json" with { type: "json" }

export interface VerifiedIdentity {
  email: string
  uid: string
  name: string
  provider: "google"
  avatarUrl?: string
}

const keys = createRemoteJWKSet(
  new URL(
    "https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com",
  ),
)

export async function verifySocialIdentity(
  token: string,
): Promise<VerifiedIdentity> {
  const projectId =
    process.env.FIREBASE_PROJECT_ID ||
    process.env.VITE_FIREBASE_PROJECT_ID ||
    firebaseConfig.projectId
  const { payload } = await jwtVerify(token, keys, {
    algorithms: ["RS256"],
    issuer: "https://securetoken.google.com/" + projectId,
    audience: projectId,
    maxTokenAge: "1h",
  })
  const provider = (payload.firebase as {
    sign_in_provider?: string
  } | undefined)?.sign_in_provider
  if (
    !payload.sub ||
    typeof payload.email !== "string" ||
    payload.email_verified !== true ||
    provider !== "google.com"
  ) {
    throw new Error("A verified Google identity is required.")
  }
  return {
    email: payload.email,
    uid: payload.sub,
    name:
      typeof payload.name === "string"
        ? payload.name
        : payload.email.split("@")[0],
    provider: "google",
    avatarUrl:
      typeof payload.picture === "string" ? payload.picture : undefined,
  }
}
