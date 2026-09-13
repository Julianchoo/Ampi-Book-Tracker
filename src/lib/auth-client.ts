import { createAuthClient } from "better-auth/react"

/**
 * No baseURL on purpose.
 *
 * The auth routes are always same-origin (/api/auth/*), so letting the client
 * default to the current origin makes it correct on localhost, on preview
 * deployments and in production without any configuration. Pinning it to
 * NEXT_PUBLIC_APP_URL previously meant a deployment whose env var still said
 * "http://localhost:3000" sent every browser sign-in request to the visitor's
 * own machine, which fails with a CORS/loopback error in production.
 */
export const authClient = createAuthClient()

export const {
  signIn,
  signOut,
  signUp,
  useSession,
  getSession,
  requestPasswordReset,
  resetPassword,
  sendVerificationEmail,
} = authClient
