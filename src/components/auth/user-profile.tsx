"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { User, LogOut } from "lucide-react";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useSession, signOut } from "@/lib/auth-client";

/**
 * `initialUser` comes from the server, which already resolved the session in
 * SiteHeader. Without it this component renders a pending state during SSR and
 * a resolved one on the client's first pass, and React throws the whole tree
 * away with a hydration mismatch. Seeding it keeps both renders identical and
 * removes the skeleton flash for signed-in visitors.
 */
export type HeaderUser = {
  name?: string | null | undefined;
  email?: string | null | undefined;
  image?: string | null | undefined;
};

export function UserProfile({
  initialUser = null,
}: {
  initialUser?: HeaderUser | null | undefined;
}) {
  const { data: session, isPending } = useSession();
  const router = useRouter();

  // Trust the server's answer until the client session actually resolves.
  const user: HeaderUser | null = isPending
    ? initialUser
    : (session?.user ?? null);

  if (!user) {
    return (
      <div className="flex items-center gap-1 sm:gap-2">
        {/* Sign up already links to sign in, so this can go on narrow screens */}
        <Link href="/login" className="hidden sm:block">
          <Button variant="ghost" size="sm">
            Sign in
          </Button>
        </Link>
        <Link href="/register">
          <Button size="sm">Sign up</Button>
        </Link>
      </div>
    );
  }

  const handleSignOut = async () => {
    await signOut();
    router.replace("/");
    router.refresh();
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Avatar className="size-8 cursor-pointer transition-opacity hover:opacity-80">
          <AvatarImage
            src={user.image || ""}
            alt={user.name || "User"}
            referrerPolicy="no-referrer"
          />
          <AvatarFallback>
            {(user.name?.[0] || user.email?.[0] || "U").toUpperCase()}
          </AvatarFallback>
        </Avatar>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="font-normal">
          <div className="flex flex-col space-y-1">
            <p className="text-sm leading-none font-medium">{user.name}</p>
            <p className="text-xs leading-none text-muted-foreground">
              {user.email}
            </p>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/profile" className="flex items-center">
            <User className="mr-2 h-4 w-4" />
            Your Profile
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={handleSignOut} variant="destructive">
          <LogOut className="mr-2 h-4 w-4" />
          Log out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
