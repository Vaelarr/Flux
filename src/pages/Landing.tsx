import { useState, useEffect } from "react"

import { Link, useNavigate } from "react-router-dom"

import FluxLogo, { FluxMark } from "../components/FluxLogo"
import { currentAccount } from "../utils/accounts"
import type { UserAccount } from "../types"

const FEATURES = [
  {
    n: "01",
    title: "Chronological feed",
    desc: "The people you follow, in the order they post.",
  },

  {
    n: "02",
    title: "Spaces",
    desc: "Talk about shared interests in open or invite-only rooms.",
  },

  {
    n: "03",
    title: "Stories",
    desc: "Share everyday moments that disappear after 24 hours.",
  },

  {
    n: "04",
    title: "The Flux Mark",
    desc: "Community recognition, earned through quality contributions.",
  },
]

const MOCK_POSTS = [
  {
    name: "Mira Okafor",
    handle: "miraokafor",
    ago: "2m",
    body: "Just finished the new series. Grateful for everyone who kept up with it. More soon.",
  },

  {
    name: "Theo Nakashima",
    handle: "theo.n",
    ago: "9m",
    body: "Reminder: the Design Spaces session opens tonight at 8pm EST. Bring questions.",
  },

  {
    name: "Solène Devaux",
    handle: "solene",
    ago: "23m",
    body: "Filed the piece. Three months of reporting distilled into 1,800 words. Worth it.",
  },
]

export default function Landing() {
  const [email, setEmail] = useState("")
  const [currentUser, setCurrentUser] = useState<UserAccount | null>(null)

  const navigate = useNavigate()

  useEffect(() => {
    let active = true
    void currentAccount()
      .then((account) => {
        if (active && account) {
          setCurrentUser(account)
        }
      })
      .catch(() => {})
    return () => {
      active = false
    }
  }, [])

  const handleJoin = (event: React.FormEvent) => {
    event.preventDefault()

    navigate("/signup", { state: { email } })
  }

  return (
    <div className="bg-cream text-forest min-h-screen">
      {/* ── Nav ── */}
      <header className="border-b border-sand">
        <nav className="max-w-6xl mx-auto flex items-center justify-between px-6 md:px-10 h-14">
          <FluxLogo />
          <div className="hidden md:flex items-center gap-6 text-sm text-dim">
            <a href="#features" className="hover:text-forest transition-colors">
              Features
            </a>
            <a
              href="#community"
              className="hover:text-forest transition-colors"
            >
              Community
            </a>
          </div>
          <div className="flex items-center gap-2.5">
            {currentUser ? (
              <>
                <Link
                  to="/profile"
                  className="flex items-center gap-2 px-2.5 py-1 rounded-md hover:bg-sand/30 transition-colors"
                >
                  <div
                    className="w-7 h-7 rounded-full flex items-center justify-center font-bold text-xs"
                    style={{ background: "#0D530E", color: "#FBF5DD" }}
                  >
                    {currentUser.name.slice(0, 2).toUpperCase()}
                  </div>
                  <span className="text-xs font-semibold hidden sm:inline text-forest">
                    {currentUser.name}
                  </span>
                </Link>
                <Link
                  to="/profile"
                  className="btn btn-forest text-xs py-2 px-3.5"
                >
                  Account Profile
                </Link>
              </>
            ) : (
              <>
                <Link to="/login" className="btn btn-ghost">
                  Sign in
                </Link>
                <Link to="/signup" className="btn btn-forest">
                  Join free
                </Link>
              </>
            )}
          </div>
        </nav>
      </header>

      {/* ── Hero ── */}
      <section className="max-w-6xl mx-auto px-6 md:px-10 py-16 md:py-24 grid md:grid-cols-[1fr_1fr] gap-12 md:gap-16 items-start">
        {/* Left — copy */}
        <div>
          <p className="text-xs font-medium tracking-widest uppercase text-green mb-6">
            A calmer social network
          </p>
          <h1
            className="font-heading font-bold leading-[1.02] tracking-tight mb-6"
            style={{ fontSize: "clamp(2.75rem, 6vw, 5rem)" }}
          >
            More connection.
            <br />
            <em>Less noise.</em>
          </h1>
          <p className="text-base leading-relaxed text-dim mb-10 max-w-sm">
            Follow your people. Share what matters.
          </p>

          {currentUser ? (
            <div className="p-4 rounded-xl border border-sand bg-white shadow-xs max-w-sm space-y-3">
              <p className="text-xs text-dim">
                Signed in as{" "}
                <strong className="text-forest">{currentUser.email}</strong>
              </p>
              <Link
                to="/profile"
                className="btn btn-forest w-full py-2.5 text-xs text-center flex items-center justify-center gap-2"
              >
                <span>Go to Account Profile & Settings</span>
                <span aria-hidden="true">→</span>
              </Link>
            </div>
          ) : (
            <form
              onSubmit={handleJoin}
              className="flex flex-col sm:flex-row gap-2.5 max-w-sm"
            >
              <input
                type="email"
                aria-label="Email address"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="your@email.com"
                className="input flex-1"
              />
              <button type="submit" className="btn btn-forest px-5 text-center">
                Join free →
              </button>
            </form>
          )}
        </div>

        {/* Right — live feed preview */}
        <div className="space-y-3 pt-1">
          <p className="text-xs font-medium tracking-widest uppercase text-dim mb-4">
            A glimpse of Flux
          </p>
          {MOCK_POSTS.map((p) => (
            <div key={p.handle} className="panel p-4">
              <div className="flex items-center justify-between mb-2.5">
                <div className="flex items-center gap-2.5">
                  <Avi name={p.name} />
                  <div>
                    <span className="text-sm font-semibold text-forest">
                      {p.name}
                    </span>
                    <span className="text-xs text-dim ml-1.5">@{p.handle}</span>
                  </div>
                </div>
                <span className="text-xs text-dim">{p.ago}</span>
              </div>
              <p className="text-sm leading-relaxed text-forest">{p.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Stats strip ── */}
      <div className="border-y border-sand">
        <div className="max-w-6xl mx-auto px-6 md:px-10 py-8 grid grid-cols-3 divide-x divide-sand">
          {[
            { n: "12M+", l: "Active users" },

            { n: "140", l: "Countries" },

            { n: "4.8 / 5", l: "App store rating" },
          ].map((s) => (
            <div key={s.l} className="text-center px-4">
              <div className="font-heading text-3xl md:text-4xl font-bold text-forest">
                {s.n}
              </div>
              <div className="text-xs text-dim mt-1 tracking-wide">{s.l}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Features ── */}
      <section
        id="features"
        className="max-w-6xl mx-auto px-6 md:px-10 py-20 md:py-28"
      >
        <div className="grid md:grid-cols-[1fr_2fr] gap-10 md:gap-16 mb-12">
          <div>
            <h2 className="font-heading text-3xl md:text-4xl font-bold leading-tight">
              Made for connection.
            </h2>
          </div>
        </div>

        <hr className="rule mb-0" />
        {FEATURES.map((f, i) => (
          <div key={f.n}>
            <div className="grid md:grid-cols-[80px_1fr_2fr] gap-4 md:gap-8 py-6 items-baseline">
              <span className="font-heading text-sm text-dim font-light">
                {f.n}
              </span>
              <h3 className="font-heading text-xl font-semibold text-forest flex items-center gap-2">
                <span>{f.title}</span>
                {f.n === "04" && <FluxMark className="w-5 h-5" />}
              </h3>
              <p className="text-sm text-dim leading-relaxed">{f.desc}</p>
            </div>
            {i < FEATURES.length - 1 && <hr className="rule" />}
          </div>
        ))}
        <hr className="rule" />
      </section>

      {/* ── Pull quote ── */}
      <section
        id="community"
        className="border-y border-sand bg-sand/30 py-16 md:py-24 px-6 md:px-10"
      >
        <div className="max-w-3xl mx-auto text-center">
          <p className="font-heading italic text-2xl md:text-4xl leading-snug text-forest mb-8">
            "The algorithm doesn't decide what I see. My choices do."
          </p>
          <div className="flex items-center justify-center gap-3">
            <Avi name="Solène Devaux" size="md" />
            <div className="text-left">
              <p className="text-sm font-semibold text-forest">Solène Devaux</p>
              <p className="text-xs text-dim">
                Independent Journalist · @solene
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── CTA section ── */}
      <section className="bg-forest text-cream py-20 md:py-28 px-6 md:px-10">
        <div className="max-w-6xl mx-auto grid md:grid-cols-2 gap-12 items-center">
          <div>
            <h2 className="font-heading text-4xl md:text-5xl font-bold leading-tight mb-4">
              Find <em>your people.</em>
            </h2>
            <p className="text-cream/60 text-sm leading-relaxed max-w-sm">
              Join Flux for free.
            </p>
          </div>
          <div>
            <form
              onSubmit={handleJoin}
              className="space-y-3 max-w-sm md:ml-auto"
            >
              <input
                type="email"
                aria-label="Email address"
                autoComplete="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="your@email.com"
                className="w-full px-4 py-3.5 rounded-[6px] text-sm outline-none"
                style={{
                  background: "rgba(251,245,221,0.1)",
                  border: "1px solid rgba(251,245,221,0.25)",
                  color: "#FBF5DD",
                }}
                onFocus={(e) => {
                  e.target.style.borderColor = "rgba(251,245,221,0.6)"
                }}
                onBlur={(e) => {
                  e.target.style.borderColor = "rgba(251,245,221,0.25)"
                }}
              />
              <button
                type="submit"
                className="block w-full text-center py-3.5 rounded-[6px] text-sm font-semibold transition-all"
                style={{ background: "#FBF5DD", color: "#0D530E" }}
                onMouseEnter={(e) => {
                  ;(e.currentTarget as HTMLElement).style.background = "#E7E1B1"
                }}
                onMouseLeave={(e) => {
                  ;(e.currentTarget as HTMLElement).style.background = "#FBF5DD"
                }}
              >
                Create account →
              </button>
            </form>
          </div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="border-t border-sand">
        <div className="max-w-6xl mx-auto px-6 md:px-10 py-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <FluxLogo />
          <div className="flex flex-wrap justify-center gap-5 text-xs text-dim">
            {["Privacy", "Terms"].map((l) => (
              <a
                key={l}
                href="#"
                className="hover:text-forest transition-colors"
              >
                {l}
              </a>
            ))}
          </div>
          <p className="text-xs text-dim">© 2026 Flux, Inc.</p>
        </div>
      </footer>
    </div>
  )
}

/* ── Shared exports ── */

export { default as FluxLogo, FluxMark } from "../components/FluxLogo"

function Avi({ name, size = "sm" }: { name: string; size?: "sm" | "md" }) {
  const initials = name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase()

  const dim = size === "md" ? "w-9 h-9 text-sm" : "w-8 h-8 text-xs"

  return (
    <div
      className={`${dim} rounded-full flex items-center justify-center font-semibold flex-shrink-0`}
      style={{ background: "#E7E1B1", color: "#0D530E" }}
    >
      {initials}
    </div>
  )
}
