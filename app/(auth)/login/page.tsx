"use client";

import { useState, useTransition } from "react";
import { authClient } from "@/lib/auth/client";

type Mode = "magiclink" | "password";

export default function LoginPage() {
  const [mode, setMode] = useState<Mode>("password");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isPending, startTransition] = useTransition();
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const handlePassword = () => {
    if (!email || !password) { setError("Enter your email and password."); return; }
    setError(null);
    startTransition(async () => {
      const result = await authClient.signIn.email({
        email, password, callbackURL: "/dashboard",
      });
      if (result.error) {
        setError(result.error.message ?? "Invalid email or password.");
      } else {
        window.location.href = "/dashboard";
      }
    });
  };

  const handleMagicLink = () => {
    if (!email) { setError("Enter your email address."); return; }
    setError(null);
    startTransition(async () => {
      const result = await authClient.signIn.magicLink({ email, callbackURL: "/dashboard" });
      if (result.error) { setError(result.error.message ?? "Something went wrong."); return; }
      setSent(true);
    });
  };

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") mode === "password" ? handlePassword() : handleMagicLink();
  };

  return (
    <div className="min-h-screen flex" style={{ background: "hsl(var(--background))" }}>
      {/* Left dark panel */}
      <div className="hidden lg:flex w-80 xl:w-96 flex-col relative overflow-hidden"
        style={{ background: "hsl(var(--charcoal))" }}>
        <div className="h-1 w-full" style={{ background: "hsl(var(--crimson))" }} />
        <div className="flex-1 flex flex-col justify-between p-10 relative z-10">
          <div>
            <div className="sidebar-logo text-3xl mb-1">TeamBase</div>
            <p className="label-caps" style={{ color: "rgba(255,255,255,0.4)", fontSize: "0.6rem" }}>
              Internal Operations Platform
            </p>
          </div>
          <blockquote className="border-l-2 pl-4" style={{ borderColor: "hsl(var(--crimson))" }}>
            <p className="text-sm leading-relaxed" style={{ color: "rgba(255,255,255,0.7)", fontFamily: "'Barlow', sans-serif" }}>
              "Blending the very best people, systems & outcomes with authentic leadership."
            </p>
            <cite className="label-caps mt-2 block" style={{ color: "rgba(255,255,255,0.3)", fontSize: "0.55rem" }}>
              — Ray Land
            </cite>
          </blockquote>
          <div className="space-y-3">
            {["Channels & DMs", "Team Presence", "Folios & BOSS", "Calendar & Huddle"].map(f => (
              <div key={f} className="flex items-center gap-3">
                <span className="w-1 h-1 rounded-full" style={{ background: "hsl(var(--crimson))" }} />
                <span className="label-caps" style={{ color: "rgba(255,255,255,0.5)", fontSize: "0.6rem" }}>{f}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right form panel */}
      <div className="flex-1 flex items-center justify-center px-6">
        <div className="w-full max-w-sm">
          {/* Mobile logo */}
          <div className="lg:hidden mb-8">
            <div className="sidebar-logo" style={{ color: "hsl(var(--crimson))", fontSize: "1.75rem" }}>TeamBase</div>
            <p className="label-caps mt-1">Ray Land Inc · Internal Operations</p>
          </div>

          <div className="mb-8">
            <h1 className="heading-lg text-foreground mb-1">Sign In</h1>
            <p className="text-sm text-muted-foreground" style={{ fontFamily: "'Barlow', sans-serif" }}>
              Ray Land Inc — authorized personnel only
            </p>
          </div>

          {sent ? (
            <div className="card-base p-6 text-center space-y-3">
              <div style={{ fontSize: "2.5rem" }}>📬</div>
              <p className="heading-sm">Check your email</p>
              <p className="text-sm text-muted-foreground" style={{ fontFamily: "'Barlow', sans-serif" }}>
                We sent a sign-in link to <strong>{email}</strong>
              </p>
              <button onClick={() => { setSent(false); setEmail(""); }}
                className="label-caps" style={{ color: "hsl(var(--crimson))", fontSize: "0.65rem" }}>
                Use a different email →
              </button>
            </div>
          ) : (
            <div className="space-y-5">
              {/* Mode toggle */}
              <div className="flex rounded-lg p-1" style={{ background: "hsl(var(--muted))" }}>
                {([["password", "🔑 Password"], ["magiclink", "✉️ Magic Link"]] as [Mode, string][]).map(([m, label]) => (
                  <button key={m} onClick={() => { setMode(m); setError(null); }}
                    className="flex-1 py-1.5 rounded-md text-sm transition-all"
                    style={{
                      fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700,
                      fontSize: "0.75rem", letterSpacing: "0.04em",
                      background: mode === m ? "hsl(var(--card))" : "transparent",
                      color: mode === m ? "hsl(var(--foreground))" : "hsl(var(--muted-foreground))",
                      boxShadow: mode === m ? "0 1px 3px rgba(0,0,0,0.1)" : "none",
                    }}>
                    {label}
                  </button>
                ))}
              </div>

              {/* Email */}
              <div>
                <label className="field-label">Email Address</label>
                <input
                  type="email" value={email} onChange={e => setEmail(e.target.value)}
                  onKeyDown={handleKey}
                  className="field-input" placeholder="you@runbusiness.com" autoFocus autoComplete="email"
                />
              </div>

              {/* Password field (password mode only) */}
              {mode === "password" && (
                <div>
                  <label className="field-label">Password</label>
                  <input
                    type="password" value={password} onChange={e => setPassword(e.target.value)}
                    onKeyDown={handleKey}
                    className="field-input" placeholder="••••••••" autoComplete="current-password"
                  />
                </div>
              )}

              {/* Error */}
              {error && (
                <div className="px-4 py-3 rounded-lg text-sm" style={{ background: "hsl(var(--crimson)/0.08)", color: "hsl(var(--crimson))", fontFamily: "'Barlow', sans-serif" }}>
                  {error}
                </div>
              )}
              {info && (
                <div className="px-4 py-3 rounded-lg text-sm" style={{ background: "hsl(142 71% 38%/0.08)", color: "hsl(142 71% 30%)", fontFamily: "'Barlow', sans-serif" }}>
                  {info}
                </div>
              )}

              {/* Submit */}
              <button
                onClick={mode === "password" ? handlePassword : handleMagicLink}
                disabled={isPending}
                className="btn-primary w-full justify-center"
                style={{ padding: "0.75rem" }}>
                {isPending
                  ? (mode === "password" ? "Signing in…" : "Sending link…")
                  : (mode === "password" ? "Sign In" : "Send Magic Link")}
              </button>

              {mode === "password" && (
                <p className="text-center label-caps" style={{ fontSize: "0.6rem" }}>
                  Don't have a password yet?{" "}
                  <button onClick={() => setMode("magiclink")} style={{ color: "hsl(var(--crimson))" }}>
                    Sign in with magic link
                  </button>
                  {" "}then set one in your Profile.
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
