"use client";

import * as React from "react";
import Link from "next/link";
import { Check, Plus } from "lucide-react";
import { toast } from "sonner";
import { badgeVariants } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { addBookToCollection, removeBookFromCollection } from "@/lib/actions/collections";

type CollectionOption = { id: string; name: string };

/** Collection badges plus a picker that saves each toggle immediately. */
export function CollectionPicker({
  bookId,
  shelf,
  assigned,
  all,
}: {
  bookId: string;
  shelf: "library" | "wishlist";
  assigned: CollectionOption[];
  all: CollectionOption[];
}) {
  const [query, setQuery] = React.useState("");
  const [pending, startTransition] = React.useTransition();

  const assignedIds = new Set(assigned.map((c) => c.id));
  // `all` hides empty collections and can lag behind `assigned`, so merge both.
  const options = [...all, ...assigned.filter((a) => !all.some((c) => c.id === a.id))];

  const name = query.trim();
  const showCreate =
    name !== "" && !options.some((c) => c.name.toLowerCase() === name.toLowerCase());

  function run(
    action: () => Promise<{ ok: true } | { ok: false; error: string }>,
    onOk?: () => void
  ) {
    startTransition(async () => {
      const result = await action();
      if (result.ok) onOk?.();
      else toast.error(result.error);
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {assigned.map((c) => (
        <Link
          key={c.id}
          href={`/${shelf}?collection=${c.id}`}
          className={badgeVariants({ variant: "secondary" })}
        >
          {c.name}
        </Link>
      ))}
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm" aria-label="Add to collection">
            <Plus className="size-4" />
            Collection
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-64 p-0" align="start">
          <Command>
            <CommandInput
              placeholder="Find or create…"
              value={query}
              onValueChange={setQuery}
            />
            <CommandList>
              {/* cmdk counts forceMount items as no match, so Empty would
                  otherwise show alongside the create item. */}
              {!showCreate && <CommandEmpty>No collections yet.</CommandEmpty>}
              <CommandGroup>
                {options.map((c) => {
                  const isAssigned = assignedIds.has(c.id);
                  return (
                    <CommandItem
                      key={c.id}
                      value={c.name}
                      disabled={pending}
                      onSelect={() =>
                        run(() =>
                          isAssigned
                            ? removeBookFromCollection(bookId, c.id)
                            : addBookToCollection(bookId, c.name)
                        )
                      }
                    >
                      <Check className={isAssigned ? "size-4" : "size-4 opacity-0"} />
                      {c.name}
                    </CommandItem>
                  );
                })}
                {showCreate && (
                  <CommandItem
                    forceMount
                    value={`create:${query}`}
                    disabled={pending}
                    // Keep the typed name on failure so it can be retried.
                    onSelect={() =>
                      run(() => addBookToCollection(bookId, name), () => setQuery(""))
                    }
                  >
                    <Plus className="size-4" />
                    Create “{name}”
                  </CommandItem>
                )}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
}
