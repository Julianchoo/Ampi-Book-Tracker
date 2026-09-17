"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";

/** Returns set(key, value): "all"/""/undefined deletes the param. router.replace, scroll: false. */
export function useSetParam(): (key: string, value: string | undefined) => void {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  return (key, value) => {
    const params = new URLSearchParams(searchParams.toString());
    if (value === "all" || !value) params.delete(key);
    else params.set(key, value);
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  };
}
