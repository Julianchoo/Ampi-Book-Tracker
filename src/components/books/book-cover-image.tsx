"use client";

import { useState } from "react";
import Image, { type ImageProps } from "next/image";
import { looksLikeCover, stepPastCandidate } from "@/lib/books";

type BookCoverImageProps = Omit<ImageProps, "src" | "alt"> & {
  /** Cover candidates, sharpest first — see coverUrls(). */
  src: string[];
  alt: string;
  fallback: React.ReactNode;
};

/**
 * Walks down the cover candidates until one is a real cover, then stops.
 *
 * A candidate fails two ways. A 404 fires onError, which is the easy one.
 * The other is silent: Google answers 200 with an "image not available"
 * graphic for volumes it has no high-res scan of, and Open Library answers
 * 200 with a 43-byte blank for a cover id it has lost — in both cases the
 * image "loads" and only its shape gives it away.
 */
export function BookCoverImage({
  src,
  alt,
  fallback,
  ...props
}: BookCoverImageProps) {
  const [index, setIndex] = useState(0);
  const url = src[index];
  if (!url) return <>{fallback}</>;

  // Never a blind increment: a repeated report for `url` must not cost a rung.
  const stepDown = () => setIndex((i) => stepPastCandidate(src, i, url));

  return (
    <Image
      // Remount on change so load/error fire again for the new candidate.
      key={url}
      src={url}
      alt={alt}
      onError={stepDown}
      onLoad={(e) => {
        const { naturalWidth, naturalHeight } = e.currentTarget;
        if (!looksLikeCover(naturalWidth, naturalHeight)) stepDown();
      }}
      {...props}
    />
  );
}
