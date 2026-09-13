import { cache } from "react";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";

/**
 * Deduped for the lifetime of one request. A page and its generateMetadata
 * both need the session, and without this each one hits the session store.
 */
const getSession = cache(async () => auth.api.getSession({ headers: await headers() }));

/**
 * Protected routes that require authentication.
 * These are also configured in src/proxy.ts for optimistic redirects.
 */
export const protectedRoutes = [
  "/library",
  "/wishlist",
  "/books",
  "/profile",
];

/**
 * Checks if the current request is authenticated.
 * Should be called in Server Components for protected routes.
 *
 * @returns The session object if authenticated
 * @throws Redirects to home page if not authenticated
 */
export async function requireAuth() {
  const session = await getSession();

  if (!session) {
    redirect("/");
  }

  return session;
}

/**
 * Gets the current session without requiring authentication.
 * Returns null if not authenticated.
 *
 * @returns The session object or null
 */
export async function getOptionalSession() {
  return await getSession();
}

/**
 * Checks if a given path is a protected route.
 *
 * @param path - The path to check
 * @returns True if the path requires authentication
 */
export function isProtectedRoute(path: string): boolean {
  return protectedRoutes.some(
    (route) => path === route || path.startsWith(`${route}/`)
  );
}
