import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { magicLink } from "better-auth/plugins";
import { db } from "@/lib/db";
import * as schema from "@/lib/db/schema";
import { Resend } from "resend";

function getResend() {
  return new Resend(process.env.RESEND_API_KEY ?? "");
}
const allowedDomain = process.env.ALLOWED_EMAIL_DOMAIN ?? "";

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: "pg",
    schema: {
      user: schema.users,
      session: schema.sessions,
      account: schema.accounts,
      verification: schema.verifications,
    },
  }),

  baseURL: process.env.BETTER_AUTH_URL,
  secret: process.env.BETTER_AUTH_SECRET,

  // ── Email + password ──────────────────────────────
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: true,
    async sendResetPassword({ user, url }) {
      await getResend().emails.send({
        from: process.env.EMAIL_FROM!,
        to: user.email,
        subject: "Reset your TeamBase password",
        html: `<p>Click <a href="${url}">here</a> to reset your password. Expires in 1 hour.</p>`,
      });
    },
  },

  // ── Email verification ────────────────────────────
  emailVerification: {
    async sendVerificationEmail({ user, url }) {
      await getResend().emails.send({
        from: process.env.EMAIL_FROM!,
        to: user.email,
        subject: "Verify your TeamBase account",
        html: `<p>Hi ${user.name},</p><p>Click <a href="${url}">here</a> to verify your email. Expires in 24 hours.</p>`,
      });
    },
    sendOnSignUp: true,
    autoSignInAfterVerification: true,
  },

  // ── Magic link plugin ─────────────────────────────
  plugins: [
    magicLink({
      sendMagicLink: async ({ email, url }) => {
        await getResend().emails.send({
          from: process.env.EMAIL_FROM!,
          to: email,
          subject: "Your TeamBase sign-in link",
          html: `
            <div style="font-family: system-ui, sans-serif; max-width: 480px; margin: 0 auto;">
              <h2 style="font-weight: 500; color: #1a1a1a;">Sign in to TeamBase</h2>
              <p style="color: #666;">Click the link below to sign in. This link expires in 15 minutes.</p>
              <a href="${url}" style="display: inline-block; margin: 16px 0; padding: 12px 24px;
                background: #1a1a1a; color: #fff; text-decoration: none; border-radius: 8px;
                font-size: 14px;">Sign in</a>
              <p style="color: #999; font-size: 12px;">If you didn't request this, you can safely ignore this email.</p>
            </div>
          `,
        });
      },
    }),
  ],

  // ── Session config ────────────────────────────────
  session: {
    expiresIn: 60 * 60 * 24 * 30, // 30 days
    updateAge: 60 * 60 * 24,      // Refresh if older than 1 day
    cookieCache: {
      enabled: true,
      maxAge: 60 * 5, // 5 min client-side cache
    },
  },

  // ── User config ───────────────────────────────────
  user: {
    additionalFields: {
      role: { type: "string", defaultValue: "member" },
      timezone: { type: "string", defaultValue: "UTC" },
    },
  },

  // Domain restriction enforced in middleware.ts and client-side

  advanced: {
    generateId: () => crypto.randomUUID(),
    cookiePrefix: "teambase",
    useSecureCookies: process.env.NODE_ENV === "production",
    crossSubDomainCookies: {
      enabled: false,
    },
  },
});

export type Auth = typeof auth;
