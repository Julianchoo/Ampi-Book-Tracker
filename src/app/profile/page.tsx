import Link from "next/link";
import { CalendarDays, Mail } from "lucide-react";
import { SignOutButton } from "@/components/auth/sign-out-button";
import { PawPrint } from "@/components/dachshund";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { getStats } from "@/lib/queries";
import { requireAuth } from "@/lib/session";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Profile" };

export default async function ProfilePage() {
  const session = await requireAuth();
  const stats = await getStats(session.user.id);
  const user = session.user;

  const memberSince = new Date(user.createdAt).toLocaleDateString("en-GB", {
    month: "long",
    year: "numeric",
  });

  const figures = [
    { label: "Books finished", value: stats.totalFinished },
    { label: "Currently reading", value: stats.totalReading },
    { label: "On the wishlist", value: stats.wishlistCount },
  ];

  return (
    <div className="container mx-auto max-w-2xl px-4 py-6 sm:py-8">
      <h1 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">
        Profile
      </h1>

      <section className="mt-5 flex items-center gap-4 rounded-lg border bg-card p-4 shadow-sm sm:p-5">
        <Avatar className="size-16">
          <AvatarImage
            src={user.image || ""}
            alt=""
            referrerPolicy="no-referrer"
          />
          <AvatarFallback className="font-display text-xl">
            {(user.name?.[0] || user.email?.[0] || "?").toUpperCase()}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0">
          <h2 className="font-display text-xl font-semibold">{user.name}</h2>
          <p className="mt-0.5 flex items-center gap-1.5 text-sm text-muted-foreground">
            <Mail className="size-3.5 shrink-0" />
            <span className="truncate">{user.email}</span>
          </p>
          <p className="mt-0.5 flex items-center gap-1.5 text-sm text-muted-foreground">
            <CalendarDays className="size-3.5 shrink-0" />
            Reading here since {memberSince}
          </p>
        </div>
      </section>

      <section className="mt-4 grid grid-cols-3 gap-3">
        {figures.map((f) => (
          <div
            key={f.label}
            className="rounded-lg border bg-card p-3 text-center shadow-sm"
          >
            <p className="font-display text-2xl font-bold tabular-nums">
              {f.value}
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">{f.label}</p>
          </div>
        ))}
      </section>

      <div className="mt-5 flex flex-wrap items-center gap-2">
        <Button asChild variant="outline">
          <Link href="/library">
            <PawPrint className="w-5" />
            Go to library
          </Link>
        </Button>
        <SignOutButton />
      </div>
    </div>
  );
}
