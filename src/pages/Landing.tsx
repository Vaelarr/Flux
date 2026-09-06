import { useState } from "react";
import { Link } from "react-router-dom";

const FEATURES = [
  { n: "01", title: "Chronological feed", desc: "Posts appear in the order they were written. No algorithm decides what you see — your choices do." },
  { n: "02", title: "Spaces", desc: "Topic-specific rooms for focused conversation. Join open stages or build invite-only circles." },
  { n: "03", title: "Stories", desc: "24-hour posts with no pressure for permanence. Layer reactions and annotations as they happen." },
  { n: "04", title: "The Flux Mark", desc: "Earned by consistent quality, not paid for. Community-driven recognition for authentic voices." },
];

const MOCK_POSTS = [
  { name: "Mira Okafor", handle: "miraokafor", ago: "2m", body: "Just finished the new series. Grateful for everyone who kept up with it. More soon." },
  { name: "Theo Nakashima", handle: "theo.n", ago: "9m", body: "Reminder: the Design Spaces session opens tonight at 8pm EST. Bring questions." },
  { name: "Solène Devaux", handle: "solene", ago: "23m", body: "Filed the piece. Three months of reporting distilled into 1,800 words. Worth it." },
];

export default function Landing() {
  const [email, setEmail] = useState("");

  return (
    <div className="bg-cream text-forest min-h-screen">

      {/* ── Nav ── */}
      <header className="border-b border-sand">
        <nav className="max-w-6xl mx-auto flex items-center justify-between px-6 md:px-10 h-14">
          <FluxLogo />
          <div className="hidden md:flex items-center gap-6 text-sm text-dim">
            <a href="#features" className="hover:text-forest transition-colors">Features</a>
            <a href="#community" className="hover:text-forest transition-colors">Community</a>
          </div>
          <div className="flex items-center gap-2">
            <Link to="/login" className="btn btn-ghost">Sign in</Link>
            <Link to="/login" className="btn btn-forest">Join free</Link>
          </div>
        </nav>
      </header>

      {/* ── Hero ── */}
      <section className="max-w-6xl mx-auto px-6 md:px-10 py-16 md:py-24 grid md:grid-cols-[1fr_1fr] gap-12 md:gap-16 items-start">
        {/* Left — copy */}
        <div>
          <p className="text-xs font-medium tracking-widest uppercase text-green mb-6">Social, rethought</p>
          <h1 className="font-heading font-bold leading-[1.02] tracking-tight mb-6"
            style={{ fontSize: "clamp(2.75rem, 6vw, 5rem)" }}>
            The social network for what <em>actually</em> matters.
          </h1>
          <p className="text-base leading-relaxed text-dim mb-10 max-w-sm">
            Real conversations. No algorithmic manipulation. 12 million people already posting, sharing, and connecting on Flux.
          </p>

          <form onSubmit={(e) => e.preventDefault()} className="flex flex-col sm:flex-row gap-2.5 max-w-sm">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="your@email.com"
              className="input flex-1"
            />
            <Link to="/login" className="btn btn-forest px-5 text-center">
              Join Flux →
            </Link>
          </form>
          <p className="text-xs text-dim mt-3">Free to start.</p>
        </div>

        {/* Right — live feed preview */}
        <div className="space-y-3 pt-1">
          <p className="text-xs font-medium tracking-widest uppercase text-dim mb-4">Live from Flux</p>
          {MOCK_POSTS.map((p) => (
            <div key={p.handle} className="panel p-4">
              <div className="flex items-center justify-between mb-2.5">
                <div className="flex items-center gap-2.5">
                  <Avi name={p.name} />
                  <div>
                    <span className="text-sm font-semibold text-forest">{p.name}</span>
                    <span className="text-xs text-dim ml-1.5">@{p.handle}</span>
                  </div>
                </div>
                <span className="text-xs text-dim">{p.ago}</span>
              </div>
              <p className="text-sm leading-relaxed text-forest">{p.body}</p>
            </div>
          ))}
          <div className="text-center pt-1">
            <span className="text-xs text-dim">Updates in real time · No curated order</span>
          </div>
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
              <div className="font-heading text-3xl md:text-4xl font-bold text-forest">{s.n}</div>
              <div className="text-xs text-dim mt-1 tracking-wide">{s.l}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Features ── */}
      <section id="features" className="max-w-6xl mx-auto px-6 md:px-10 py-20 md:py-28">
        <div className="grid md:grid-cols-[1fr_2fr] gap-10 md:gap-16 mb-12">
          <div>
            <p className="text-xs font-medium tracking-widest uppercase text-green mb-3">What Flux does</p>
            <h2 className="font-heading text-3xl md:text-4xl font-bold leading-tight">
              Simple tools for real connection.
            </h2>
          </div>
          <p className="text-dim leading-relaxed self-end text-sm md:text-base max-w-lg">
            Flux strips back the features that fuel anxiety and keeps the ones that build genuine community.
          </p>
        </div>

        <hr className="rule mb-0" />
        {FEATURES.map((f, i) => (
          <div key={f.n}>
            <div className="grid md:grid-cols-[80px_1fr_2fr] gap-4 md:gap-8 py-6 items-baseline">
              <span className="font-heading text-sm text-dim font-light">{f.n}</span>
              <h3 className="font-heading text-xl font-semibold text-forest">{f.title}</h3>
              <p className="text-sm text-dim leading-relaxed">{f.desc}</p>
            </div>
            {i < FEATURES.length - 1 && <hr className="rule" />}
          </div>
        ))}
        <hr className="rule" />
      </section>

      {/* ── Pull quote ── */}
      <section id="community" className="border-y border-sand bg-sand/30 py-16 md:py-24 px-6 md:px-10">
        <div className="max-w-3xl mx-auto text-center">
          <p className="font-heading italic text-2xl md:text-4xl leading-snug text-forest mb-8">
            "The algorithm doesn't decide what I see. My choices do — and that changes everything."
          </p>
          <div className="flex items-center justify-center gap-3">
            <Avi name="Solène Devaux" size="md" />
            <div className="text-left">
              <p className="text-sm font-semibold text-forest">Solène Devaux</p>
              <p className="text-xs text-dim">Independent Journalist · @solene</p>
            </div>
          </div>
        </div>
      </section>

      {/* ── CTA section ── */}
      <section className="bg-forest text-cream py-20 md:py-28 px-6 md:px-10">
        <div className="max-w-6xl mx-auto grid md:grid-cols-2 gap-12 items-center">
          <div>
            <h2 className="font-heading text-4xl md:text-5xl font-bold leading-tight mb-4">
              Join 12 million people doing social <em>differently.</em>
            </h2>
            <p className="text-cream/60 text-sm leading-relaxed max-w-sm">
              Free to start. Upgrade to Flux Pro for custom domains, advanced analytics, and Space hosting tools.
            </p>
          </div>
          <div>
            <form onSubmit={(e) => e.preventDefault()} className="space-y-3 max-w-sm md:ml-auto">
              <input
                type="email"
                placeholder="your@email.com"
                className="w-full px-4 py-3.5 rounded-[6px] text-sm outline-none"
                style={{ background: "rgba(251,245,221,0.1)", border: "1px solid rgba(251,245,221,0.25)", color: "#FBF5DD" }}
                onFocus={(e) => { e.target.style.borderColor = "rgba(251,245,221,0.6)"; }}
                onBlur={(e) => { e.target.style.borderColor = "rgba(251,245,221,0.25)"; }}
              />
              <Link to="/login"
                className="block w-full text-center py-3.5 rounded-[6px] text-sm font-semibold transition-all"
                style={{ background: "#FBF5DD", color: "#0D530E" }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "#E7E1B1"; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "#FBF5DD"; }}>
                Create your account →
              </Link>
              <p className="text-xs text-cream/40 text-center">No card required. Cancel any time.</p>
            </form>
          </div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="border-t border-sand">
        <div className="max-w-6xl mx-auto px-6 md:px-10 py-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <FluxLogo />
          <div className="flex flex-wrap justify-center gap-5 text-xs text-dim">
            {["Privacy", "Terms", "Careers", "Press", "Blog"].map((l) => (
              <a key={l} href="#" className="hover:text-forest transition-colors">{l}</a>
            ))}
          </div>
          <p className="text-xs text-dim">© 2026 Flux, Inc.</p>
        </div>
      </footer>
    </div>
  );
}

/* ── Shared exports ── */
export function FluxLogo() {
  return (
    <Link to="/" className="flex items-center gap-2 flex-shrink-0">
      <div className="w-7 h-7 rounded-[5px] flex items-center justify-center"
        style={{ background: "#0D530E" }}>
        <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
          <path d="M6.5 1L2 7.5H6L5.5 12L11 5.5H7L6.5 1Z" fill="#FBF5DD" />
        </svg>
      </div>
      <span className="font-heading font-bold text-lg text-forest tracking-tight">Flux</span>
    </Link>
  );
}

function Avi({ name, size = "sm" }: { name: string; size?: "sm" | "md" }) {
  const initials = name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();
  const dim = size === "md" ? "w-9 h-9 text-sm" : "w-8 h-8 text-xs";
  return (
    <div className={`${dim} rounded-full flex items-center justify-center font-semibold flex-shrink-0`}
      style={{ background: "#E7E1B1", color: "#0D530E" }}>
      {initials}
    </div>
  );
}
