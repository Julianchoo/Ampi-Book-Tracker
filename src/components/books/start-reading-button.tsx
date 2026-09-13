"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { BookOpen, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { moveToLibrary } from "@/lib/actions/books";

/** Wishlist → library, dated today. */
export function StartReadingButton({
  id,
  title,
}: {
  id: string;
  title: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();

  return (
    <Button
      size="sm"
      variant="secondary"
      className="h-9 w-full text-xs"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          const result = await moveToLibrary(id);
          if (!result.ok) {
            toast.error(result.error);
            return;
          }
          toast.success(`Started “${title}” — happy reading`);
          router.push(`/books/${id}`);
        })
      }
    >
      {pending ? (
        <Loader2 className="size-3.5 animate-spin" />
      ) : (
        <BookOpen className="size-3.5" />
      )}
      Start reading
    </Button>
  );
}
