"use client";

import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Goes back to wherever the user came from (a search page, the dropdown's
 * originating page, …). A book's own page can link "back to library" because
 * it always knows its shelf; a search hit's preview doesn't know its origin,
 * so history is the only thing that does.
 */
export function BackButton({ fallbackHref = "/" }: { fallbackHref?: string }) {
  const router = useRouter();
  return (
    <Button
      variant="ghost"
      size="sm"
      className="-ml-2 mb-3"
      onClick={() => {
        if (typeof window !== "undefined" && window.history.length > 1) {
          router.back();
        } else {
          router.push(fallbackHref);
        }
      }}
    >
      <ArrowLeft className="size-4" />
      Back
    </Button>
  );
}
