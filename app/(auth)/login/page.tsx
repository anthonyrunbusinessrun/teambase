"use client";

import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { authClient } from "@/lib/auth/client";
import { magicLinkSchema, type MagicLinkInput } from "@/lib/validations/auth";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<MagicLinkInput>({
    resolver: zodResolver(magicLinkSchema),
  });

  const onSubmit = (data: MagicLinkInput) => {
    setError(null);
    startTransition(async () => {
      try {
        const result = await authClient.signIn.magicLink({
          email: data.email,
          callbackURL: "/dashboard",
        });

        if (result.error) {
          setError(result.error.message ?? "Something went wrong");
          return;
        }

        setSent(true);
      } catch (e) {
        setError("Failed to send sign-in link. Please try again.");
      }
    });
  };

  return (
    <div className="min-h-svh flex items-center justify-center bg-background px-6">
      <div className="w-full max-w-sm">
        {/* Logo / wordmark */}
        <div className="mb-10 text-center">
          <h1 className="text-2xl font-light tracking-tight text-foreground mb-1">
            TeamBase
          </h1>
          <p className="text-sm text-muted-foreground">Internal operations</p>
        </div>

        {sent ? (
          <div className="card-base p-6 text-center">
            <div className="w-10 h-10 rounded-full bg-accent/10 flex items-center justify-center mx-auto mb-4">
              <span className="text-accent text-lg">✓</span>
            </div>
            <h2 className="text-base font-medium text-foreground mb-2">
              Check your email
            </h2>
            <p className="text-sm text-muted-foreground">
              We sent a sign-in link. It expires in 15 minutes.
            </p>
            <button
              onClick={() => setSent(false)}
              className="mt-4 text-sm text-accent hover:text-accent/80 transition-colors"
            >
              Send another
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div>
              <label
                htmlFor="email"
                className="text-xs font-medium text-muted-foreground block mb-1.5"
              >
                Work email
              </label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                autoFocus
                placeholder="you@company.com"
                className="w-full bg-card border border-border rounded-xl px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring transition"
                {...register("email")}
              />
              {errors.email && (
                <p className="text-xs text-red-500 mt-1.5">{errors.email.message}</p>
              )}
            </div>

            {error && (
              <p className="text-sm text-red-500 bg-red-50 dark:bg-red-950/30 px-4 py-3 rounded-xl">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={isPending}
              className="w-full bg-primary text-primary-foreground rounded-xl py-3 text-sm font-medium transition-opacity disabled:opacity-50"
            >
              {isPending ? "Sending…" : "Send sign-in link"}
            </button>

            <p className="text-center text-xs text-muted-foreground">
              Access restricted to company email addresses
            </p>
          </form>
        )}
      </div>
    </div>
  );
}
