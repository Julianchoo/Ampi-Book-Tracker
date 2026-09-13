"use client";

import * as React from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { signIn } from "@/lib/auth-client";

/** Google's brand mark. Fixed colours by design — Google's terms require it. */
function GoogleMark({ className }: { className?: string | undefined }) {
  return (
    <svg viewBox="0 0 18 18" className={className} aria-hidden="true">
      <path
        fill="#4285F4"
        d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62Z"
      />
      <path
        fill="#34A853"
        d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.81.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.33A9 9 0 0 0 9 18Z"
      />
      <path
        fill="#FBBC05"
        d="M3.97 10.72a5.4 5.4 0 0 1 0-3.44V4.95H.96a9 9 0 0 0 0 8.1l3.01-2.33Z"
      />
      <path
        fill="#EA4335"
        d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58C13.46.9 11.43 0 9 0A9 9 0 0 0 .96 4.95l3.01 2.33C4.68 5.16 6.66 3.58 9 3.58Z"
      />
    </svg>
  );
}

/**
 * Google OAuth entry point. The same button serves sign-in and sign-up —
 * Google creates the account on first use — so only the label differs.
 */
export function GoogleButton({
  label = "Continue with Google",
  callbackURL = "/",
}: {
  label?: string | undefined;
  callbackURL?: string | undefined;
}) {
  const [pending, setPending] = React.useState(false);

  return (
    <Button
      type="button"
      variant="outline"
      className="h-10 w-full"
      disabled={pending}
      onClick={async () => {
        setPending(true);
        const { error } = await signIn.social({ provider: "google", callbackURL });
        // On success the browser is already navigating to Google; only an
        // immediate failure comes back here.
        if (error) {
          setPending(false);
          toast.error(error.message || "Couldn't start Google sign-in.");
        }
      }}
    >
      {pending ? (
        <Loader2 className="size-4 animate-spin" />
      ) : (
        <GoogleMark className="size-4" />
      )}
      {label}
    </Button>
  );
}

/** "or" rule between the Google button and the email form. */
export function AuthDivider() {
  return (
    <div className="flex w-full items-center gap-3">
      <span className="h-px flex-1 bg-border" />
      <span className="text-xs text-muted-foreground">or</span>
      <span className="h-px flex-1 bg-border" />
    </div>
  );
}
