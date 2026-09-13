"use client";

import { useState } from "react";
import Image, { type ImageProps } from "next/image";

type BookCoverImageProps = Omit<ImageProps, "src" | "alt"> & {
  src: string | null;
  alt: string;
  fallback: React.ReactNode;
};

/**
 * Google's cover endpoint 404s for some in-print catalog entries at the
 * zoom level a page asks for, even though a lower-res thumbnail exists for
 * the same olKey — coverUrl() can't know that in advance, so the failure
 * only shows up once the browser tries to load it.
 */
export function BookCoverImage({ src, alt, fallback, ...props }: BookCoverImageProps) {
  const [errored, setErrored] = useState(false);
  if (!src || errored) return <>{fallback}</>;
  return <Image src={src} alt={alt} onError={() => setErrored(true)} {...props} />;
}
