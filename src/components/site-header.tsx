import Link from "next/link";
import { Heart, Home, Library, Menu } from "lucide-react";
import { UserProfile } from "@/components/auth/user-profile";
import { DachshundLogo } from "@/components/dachshund";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { getOptionalSession } from "@/lib/session";
import { ModeToggle } from "./ui/mode-toggle";

const NAV = [
  { href: "/library", label: "Library", icon: Library },
  { href: "/wishlist", label: "Wishlist", icon: Heart },
];

export async function SiteHeader() {
  const session = await getOptionalSession();

  return (
    <>
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:rounded-md focus:border focus:bg-background focus:px-4 focus:py-2 focus:text-foreground"
      >
        Skip to main content
      </a>
      <header
        className="sticky top-0 z-40 border-b bg-background/85 backdrop-blur-sm"
        role="banner"
      >
        <nav
          className="container mx-auto flex items-center justify-between gap-2 px-3 py-2.5 sm:px-4 sm:py-3"
          aria-label="Main navigation"
        >
          <Link
            href="/"
            className="flex min-w-0 items-center gap-2"
            aria-label="Ampi's Book Tracker — home"
          >
            <DachshundLogo className="w-12 shrink-0 text-primary sm:w-16" />
            <span className="truncate font-display text-base leading-none font-semibold tracking-tight sm:text-xl">
              Ampi&rsquo;s Book Tracker
            </span>
          </Link>

          <div className="flex items-center gap-1 sm:gap-2">
            {session && (
              <div className="hidden items-center gap-1 sm:flex">
                {NAV.map(({ href, label, icon: Icon }) => (
                  <Button key={href} asChild variant="ghost" size="sm">
                    <Link href={href}>
                      <Icon className="size-4" />
                      {label}
                    </Link>
                  </Button>
                ))}
              </div>
            )}

            <UserProfile initialUser={session?.user ?? null} />
            <ModeToggle />

            {session && (
              <Sheet>
                <SheetTrigger asChild className="sm:hidden">
                  <Button variant="ghost" size="icon" aria-label="Open menu">
                    <Menu className="size-5" />
                  </Button>
                </SheetTrigger>
                <SheetContent side="right" className="w-64">
                  <SheetHeader>
                    <SheetTitle className="font-display">Ampi&rsquo;s Book Tracker</SheetTitle>
                  </SheetHeader>
                  <div className="flex flex-col gap-1 px-4">
                    {[{ href: "/", label: "Home", icon: Home }, ...NAV].map(
                      ({ href, label, icon: Icon }) => (
                        <Button
                          key={href}
                          asChild
                          variant="ghost"
                          className="h-11 justify-start"
                        >
                          <Link href={href}>
                            <Icon className="size-4" />
                            {label}
                          </Link>
                        </Button>
                      )
                    )}
                  </div>
                </SheetContent>
              </Sheet>
            )}
          </div>
        </nav>
      </header>
    </>
  );
}
