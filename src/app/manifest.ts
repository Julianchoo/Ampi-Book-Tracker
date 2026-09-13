import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Ampi's Book Tracker — your reading tracker",
    short_name: "Ampi's Book Tracker",
    description:
      "A cosy personal reading tracker. Search any book, shelve it, rate it, and watch your reading year take shape.",
    start_url: "/",
    display: "standalone",
    background_color: "#faf7f2",
    theme_color: "#8a2222",
    icons: [
      {
        src: "/favicon.ico",
        sizes: "any",
        type: "image/x-icon",
      },
      {
        src: "/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "any",
      },
    ],
  };
}
