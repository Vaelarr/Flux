import assert from "node:assert/strict"
import { test } from "node:test"
import { createClient } from "@libsql/client"
import { AuthService, type AuthContext } from "../server/auth.js"
import { checkPassword } from "../server/crypto.js"
import { initializeDatabase } from "../server/db.js"
import type { RecoveryEmail } from "../server/mail.js"

const INITIAL_PASSWORD = "Pine-Shadow-74!valley"
const UPDATED_PASSWORD = "River-Meadow-85!forest"
const context: AuthContext = {
  ip: "profile-test-client",
  userAgent: "Mozilla/5.0 (Windows NT 10.0) Chrome/130.0",
}

async function fixture() {
  const database = createClient({ url: "file::memory:" })
  await initializeDatabase(database)
  let now = Date.now()
  const emails: RecoveryEmail[] = []
  const options = {
    database,
    secret: "test-secret-at-least-thirty-two-characters-long",
    now: () => now,
    recoveryDelayMs: 0,
    mailer: {
      assertConfigured() {},
      async send(message: RecoveryEmail) {
        emails.push(message)
      },
    },
    async verifyIdentity(token: string) {
      if (token !== "verified-token") throw new Error("Invalid token")
      return {
        uid: "verified-uid",
        email: "social@example.com",
        name: "Social User",
        provider: "google" as const,
      }
    },
  }
  const service = new AuthService(options)
  const registered = await service.register(
    {
      name: "Original Name",
      email: "profile-user@example.com",
      password: INITIAL_PASSWORD,
    },
    context,
  )
  const session = await service.login(
    {
      email: "profile-user@example.com",
      password: INITIAL_PASSWORD,
      remember: true,
    },
    context,
  )

  const authedContext: AuthContext = {
    ...context,
    sessionToken: session.token,
  }

  return {
    database,
    service,
    emails,
    user: registered.user,
    session,
    authedContext,
    close: () => database.close(),
  }
}

test("updateProfile updates name, bio, phoneNumber, and avatarUrl", async () => {
  const f = await fixture()
  try {
    const updated = await f.service.updateProfile(
      {
        name: "Jane Doe",
        bio: "Exploring the calm web with Flux.",
        phoneNumber: "+1 202 555 0123",
        avatarUrl: "teal",
      },
      f.authedContext,
    )
    assert.equal(updated.user.name, "Jane Doe")
    assert.equal(updated.user.bio, "Exploring the calm web with Flux.")
    assert.equal(updated.user.phoneNumber, "+12025550123")
    assert.equal(updated.user.avatarUrl, "teal")

    // Verify persisted in database
    const sessionUser = (await f.service.session(f.authedContext)).user
    assert.equal(sessionUser.name, "Jane Doe")
    assert.equal(sessionUser.bio, "Exploring the calm web with Flux.")
  } finally {
    f.close()
  }
})

test("changePassword requires correct current password and validates new password", async () => {
  const f = await fixture()
  try {
    // Fails with incorrect current password
    await assert.rejects(
      f.service.changePassword(
        {
          currentPassword: "Wrong-Password-1234!",
          newPassword: UPDATED_PASSWORD,
        },
        f.authedContext,
      ),
      { status: 401 },
    )

    // Fails with weak new password (too short)
    await assert.rejects(
      f.service.changePassword(
        {
          currentPassword: INITIAL_PASSWORD,
          newPassword: "short",
        },
        f.authedContext,
      ),
      { status: 400 },
    )

    // Succeeds with correct current password and NIST-compliant new password
    const result = await f.service.changePassword(
      {
        currentPassword: INITIAL_PASSWORD,
        newPassword: UPDATED_PASSWORD,
        revokeOtherSessions: true,
      },
      f.authedContext,
    )
    assert.equal(result.success, true)

    // Current session remains valid
    const sessionCheck = await f.service.session(f.authedContext)
    assert.equal(sessionCheck.user.email, "profile-user@example.com")
    assert.ok(sessionCheck.user.lastPasswordReset)

    // Old password no longer logs in
    await assert.rejects(
      f.service.login(
        { email: "profile-user@example.com", password: INITIAL_PASSWORD },
        context,
      ),
      { status: 401 },
    )

    // New password logs in successfully
    const newLogin = await f.service.login(
      { email: "profile-user@example.com", password: UPDATED_PASSWORD },
      context,
    )
    assert.ok(newLogin.token)
  } finally {
    f.close()
  }
})

test("active devices can be listed and individual or other sessions can be revoked", async () => {
  const f = await fixture()
  try {
    // Create a second session
    const secondSession = await f.service.login(
      { email: "profile-user@example.com", password: INITIAL_PASSWORD },
      {
        ip: "device-2",
        userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0) Mobile",
      },
    )

    const sessions = await f.service.getSessions(f.authedContext)
    assert.equal(sessions.sessions.length, 2)
    assert.equal(
      sessions.sessions.some((s) => s.isCurrent),
      true,
    )

    // Revoke other sessions
    await f.service.revokeOtherSessions(f.authedContext)

    // First session still works
    assert.ok(await f.service.session(f.authedContext))

    // Second session was revoked
    await assert.rejects(
      f.service.session({
        ip: "device-2",
        userAgent: "iPhone",
        sessionToken: secondSession.token,
      }),
      { status: 401 },
    )
  } finally {
    f.close()
  }
})

test("deleteAccount deletes account, sessions, and resets", async () => {
  const f = await fixture()
  try {
    // Rejects with incorrect password
    await assert.rejects(
      f.service.deleteAccount({ password: "wrong" }, f.authedContext),
      { status: 401 },
    )

    // Succeeds with correct password
    const result = await f.service.deleteAccount(
      { password: INITIAL_PASSWORD },
      f.authedContext,
    )
    assert.equal(result.success, true)

    // Session is gone
    await assert.rejects(f.service.session(f.authedContext), { status: 401 })
  } finally {
    f.close()
  }
})
