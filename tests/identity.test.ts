import assert from "node:assert/strict"
import { test } from "node:test"
import { exportJWK, generateKeyPair, SignJWT } from "jose"
import firebaseConfig from "../firebase-applet-config.json" with { type: "json" }
import { verifySocialIdentity } from "../server/identity.js"

test("signed Google identities are accepted and signed Apple identities are rejected", async (t) => {
  const { publicKey, privateKey } = await generateKeyPair("RS256")
  const key = {
    ...(await exportJWK(publicKey)),
    kid: "identity-test",
    alg: "RS256",
    use: "sig",
  }
  const projectId =
    process.env.FIREBASE_PROJECT_ID ||
    process.env.VITE_FIREBASE_PROJECT_ID ||
    firebaseConfig.projectId
  const fetchMock = t.mock.method(
    globalThis,
    "fetch",
    async (input: string | URL | Request) => {
      assert.equal(
        String(input),
        "https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com",
      )
      return Response.json({ keys: [key] })
    },
  )
  t.after(() => fetchMock.mock.restore())

  const token = (provider: string) =>
    new SignJWT({
      email: "identity@example.com",
      email_verified: true,
      name: "Identity User",
      firebase: { sign_in_provider: provider },
    })
      .setProtectedHeader({ alg: "RS256", kid: key.kid })
      .setIssuer("https://securetoken.google.com/" + projectId)
      .setAudience(projectId)
      .setSubject("identity-user")
      .setIssuedAt()
      .setExpirationTime("5m")
      .sign(privateKey)

  const google = await verifySocialIdentity(await token("google.com"))
  assert.equal(google.provider, "google")
  assert.equal(google.email, "identity@example.com")
  await assert.rejects(
    verifySocialIdentity(await token("apple.com")),
    /verified Google identity/,
  )
})
