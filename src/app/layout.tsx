import {
  Poppins,
  Libre_Baskerville,
  IBM_Plex_Mono,
} from "next/font/google";
import "./globals.css";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "@/components/ui/sonner";
import type { Metadata } from "next";

/*
 * The three faces the theme in globals.css names. Loaded here through
 * next/font so they are self-hosted and the CSS variables the theme reads
 * (--font-sans / --font-serif / --font-mono) actually resolve to a real file.
 */
const poppins = Poppins({
  variable: "--font-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

// The bookish half of the personality: headings only, via .font-display.
const libreBaskerville = Libre_Baskerville({
  variable: "--font-serif",
  subsets: ["latin"],
  weight: ["400", "700"],
});

const ibmPlexMono = IBM_Plex_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  weight: ["400", "500"],
});

export const metadata: Metadata = {
  title: {
    default: "Ampi's Book Tracker — your reading tracker",
    template: "%s | Ampi's Book Tracker",
  },
  description:
    "A cosy personal reading tracker. Search any book, shelve it in your library or wishlist, rate it out of ten, and watch your reading year take shape.",
  keywords: [
    "reading tracker",
    "book tracker",
    "reading list",
    "book log",
    "wishlist",
    "book ratings",
  ],
  applicationName: "Ampi's Book Tracker",
  openGraph: {
    type: "website",
    locale: "en_GB",
    siteName: "Ampi's Book Tracker",
    title: "Ampi's Book Tracker — your reading tracker",
    description:
      "Search any book, shelve it, rate it out of ten, and watch your reading year take shape.",
  },
  twitter: {
    card: "summary_large_image",
    title: "Ampi's Book Tracker — your reading tracker",
    description:
      "Search any book, shelve it, rate it out of ten, and watch your reading year take shape.",
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${poppins.variable} ${libreBaskerville.variable} ${ibmPlexMono.variable} font-sans flex min-h-screen flex-col antialiased`}
      >
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <SiteHeader />
          <main id="main-content" className="flex-1">
            {children}
          </main>
          <SiteFooter />
          <Toaster richColors position="top-center" />
        </ThemeProvider>
      </body>
    </html>
  );
}
