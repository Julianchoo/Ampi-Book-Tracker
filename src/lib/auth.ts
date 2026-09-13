import { betterAuth } from "better-auth"
import { drizzleAdapter } from "better-auth/adapters/drizzle"
import { db } from "./db"

/**
 * OAuth redirect URIs must match what the provider has registered, so in
 * production the base URL has to be the stable public domain rather than
 * whatever host the request happened to arrive on. Previews and local dev fall
 * through to undefined, where Better Auth derives it from the request.
 */
const baseURL =
  process.env.BETTER_AUTH_URL ||
  (process.env.VERCEL_ENV === "production" &&
  process.env.VERCEL_PROJECT_PRODUCTION_URL
    ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
    : undefined)

const googleClientId = process.env.GOOGLE_CLIENT_ID
const googleClientSecret = process.env.GOOGLE_CLIENT_SECRET

/**
 * Google is registered only when both credentials are present. Better Auth
 * throws at import time on a half-configured provider, which would take the
 * whole app down rather than just hiding the button.
 */
export const isGoogleEnabled = Boolean(googleClientId && googleClientSecret)

export const auth = betterAuth({
  ...(baseURL ? { baseURL } : {}),
  database: drizzleAdapter(db, {
    provider: "pg",
  }),
  socialProviders: isGoogleEnabled
    ? {
        google: {
          clientId: googleClientId!,
          clientSecret: googleClientSecret!,
        },
      }
    : {},
  account: {
    accountLinking: {
      enabled: true,
      // Google verifies its own addresses, so linking to an existing
      // email/password account of the same address is safe.
      trustedProviders: ["google"],
    },
  },
  emailAndPassword: {
    enabled: true,
    sendResetPassword: async ({ user, url }) => {
      // Log password reset URL to terminal (no email integration yet)
      // eslint-disable-next-line no-console
      console.log(`\n${"=".repeat(60)}\nPASSWORD RESET REQUEST\nUser: ${user.email}\nReset URL: ${url}\n${"=".repeat(60)}\n`)
    },
  },
  emailVerification: {
    sendOnSignUp: true,
    sendVerificationEmail: async ({ user, url }) => {
      // Log verification URL to terminal (no email integration yet)
      // eslint-disable-next-line no-console
      console.log(`\n${"=".repeat(60)}\nEMAIL VERIFICATION\nUser: ${user.email}\nVerification URL: ${url}\n${"=".repeat(60)}\n`)
    },
  },
})