"use client";

import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { authClient } from "@/lib/auth/client";
import { magicLinkSchema, type MagicLinkInput } from "@/lib/validations/auth";

export default function LoginPage() {
  const [isPending, startTransition] = useTransition();
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { register, handleSubmit, formState: { errors } } = useForm<MagicLinkInput>({
    resolver: zodResolver(magicLinkSchema),
  });

  const onSubmit = (data: MagicLinkInput) => {
    setError(null);
    startTransition(async () => {
      try {
        const result = await authClient.signIn.magicLink({ email: data.email, callbackURL: "/dashboard" });
        if (result.error) { setError(result.error.message ?? "Something went wrong"); return; }
        setSent(true);
      } catch { setError("Failed to send sign-in link. Please try again."); }
    });
  };

  return (
    <div className="min-h-screen flex" style={{ background: "hsl(var(--background))" }}>
      {/* Left panel — Rayland style dark sidebar */}
      <div className="hidden lg:flex w-80 xl:w-96 flex-col relative overflow-hidden"
        style={{ background: "hsl(var(--charcoal))" }}>
        {/* Stripe accent */}
        <div className="absolute top-0 right-0 bottom-0 w-8 stripe-bg opacity-20" />
        {/* Red top bar */}
        <div className="h-1 w-full" style={{ background: "hsl(var(--crimson))" }} />

        <div className="flex-1 flex flex-col justify-between p-10 relative z-10">
          <div>
            <div className="sidebar-logo text-3xl mb-1">TeamBase</div>
            <p className="label-caps" style={{ color: "rgba(255,255,255,0.4)", fontSize: "0.6rem" }}>
              Internal Operations Platform
            </p>
          </div>

          <div>
            <blockquote className="border-l-2 pl-4" style={{ borderColor: "hsl(var(--crimson))" }}>
              <p className="text-sm leading-relaxed" style={{ color: "rgba(255,255,255,0.7)", fontFamily: "'Barlow', sans-serif" }}>
                "Blending the very best people, systems & outcomes with authentic leadership."
              </p>
              <cite className="label-caps mt-2 block" style={{ color: "rgba(255,255,255,0.3)", fontSize: "0.55rem" }}>
                — Ray Land
              </cite>
            </blockquote>
          </div>

          <div className="space-y-3">
            {["Presence Tracking", "Action Items", "World Clocks", "Airtable Sync"].map((f) => (
              <div key={f} className="flex items-center gap-3">
                <span className="w-1 h-1 rounded-full flex-shrink-0" style={{ background: "hsl(var(--crimson))" }} />
                <span className="label-caps" style={{ color: "rgba(255,255,255,0.5)", fontSize: "0.6rem" }}>{f}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right panel — login form */}
      <div className="flex-1 flex items-center justify-center px-6">
        <div className="w-full max-w-sm">
          {/* Mobile logo */}
          <div className="lg:hidden mb-8">
            <div className="sidebar-logo" style={{ color: "hsl(var(--crimson))", fontSize: "1.75rem" }}>TeamBase</div>
            <p className="label-caps mt-1">Internal Operations</p>
          </div>

          {/* Heading */}
          <div className="mb-8">
            <h1 className="heading-lg text-foreground mb-2">Sign In</h1>
            <p className="text-sm text-muted-foreground" style={{ fontFamily: "'Barlow', sans-serif" }}>
              Enter your work email to receive a secure sign-in link.
            </p>
          </div>

          {sent ? (
            <div className="card-accent p-5">
              <div className="heading-sm text-foreground mb-2">Check Your Inbox</div>
              <p className="text-sm text-muted-foreground mb-4" style={{ fontFamily: "'Barlow', sans-serif" }}>
                We sent a sign-in link to your email. It expires in 15 minutes.
              </p>
              <button onClick={() => setSent(false)} className="label-caps" style={{ color: "hsl(var(--crimson))" }}>
                Send another →
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div>
                <label className="field-label">Work Email</label>
                <input
                  type="email"
                  autoComplete="email"
                  autoFocus
                  placeholder="you@runbusiness.com"
                  className="field-input"
                  {...register("email")}
                />
                {errors.email && (
                  <p className="label-caps mt-1.5" style={{ color: "hsl(var(--crimson))" }}>
                    {errors.email.message}
                  </p>
                )}
              </div>

              {error && (
                <div className="card-accent p-3">
                  <p className="text-sm" style={{ color: "hsl(var(--crimson))", fontFamily: "'Barlow', sans-serif" }}>{error}</p>
                </div>
              )}

              <button type="submit" disabled={isPending} className="btn-primary w-full justify-center">
                {isPending ? "Sending…" : "Send Sign-In Link"}
              </button>

              <p className="label-caps text-center" style={{ fontSize: "0.6rem" }}>
                Access restricted to company email addresses
              </p>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
