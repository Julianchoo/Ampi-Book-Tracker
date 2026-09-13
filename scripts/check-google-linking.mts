// Run: pnpm exec tsx scripts/check-google-linking.mts
// Exercises the installed OAuth handler with an in-memory adapter, never the DB.
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { pathToFileURL } from "node:url";

process.env.POSTGRES_URL = "postgres://test:test@127.0.0.1:1/unused";
const { auth } = await import("../src/lib/auth");
const require = createRequire(import.meta.url);
const handlerURL = pathToFileURL(join(dirname(require.resolve("better-auth")), "oauth2/link-account.mjs"));
const { handleOAuthUserInfo } = await import(handlerURL.href);

for (const scenario of [
  { email: "reader@example.com", verified: true, linked: true },
  { email: "reader@example.com", verified: false, linked: false },
  { email: "other@example.com", verified: true, linked: false },
]) {
  const user = { id: "existing-user", email: "reader@example.com", emailVerified: false };
  const credentials = { id: "password-account", providerId: "credential", userId: user.id };
  const accounts: Record<string, unknown>[] = [credentials];
  let sessions = 0;
  const result = await handleOAuthUserInfo({
    context: {
      options: auth.options,
      trustedProviders: auth.options.account?.accountLinking?.trustedProviders ?? [],
      socialProviders: [{ id: "google", options: {} }],
      logger: { warn() {}, error(message: string) { throw new Error(message); } },
      internalAdapter: {
        findAccountOwnerByKey: async () => null,
        findUserByEmail: async (email: string) => email === user.email ? { user, accounts } : null,
        linkAccount: async (account: Record<string, unknown>) => { accounts.push(account); return account; },
        updateUser: async (id: string, update: object) => { assert.equal(id, user.id); return Object.assign(user, update); },
        createSession: async (userId: string) => { assert.equal(userId, user.id); sessions++; return { userId }; },
      },
    },
  }, {
    userInfo: { id: "google-id", name: "Reader", email: scenario.email, emailVerified: scenario.verified },
    account: { accountId: "google-id", providerId: "google" },
    callbackURL: "/library",
    disableSignUp: true,
  });
  assert.equal(result.error === null, scenario.linked);
  assert.equal(accounts.length, scenario.linked ? 2 : 1);
  assert.equal(sessions, scenario.linked ? 1 : 0);
  assert.equal(user.emailVerified, scenario.linked);
  assert.equal(accounts[0], credentials);
  if (scenario.linked) assert.equal(accounts[1].userId, user.id);
}
process.stdout.write("Google linking checks passed: verified match links existing user; unverified and different emails do not.\n");
