import Link from "next/link";
import { DachshundLogo } from "@/components/dachshund";

/*
 * One themed shell for login / register / forgot / reset, rather than
 * repeating the mascot and background on each of the four pages.
 */
export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="auth-bg min-h-[calc(100vh-8rem)]">
      <div className="flex flex-col items-center px-4 pt-10 sm:pt-14">
        <Link
          href="/"
          aria-label="Ampi's Book Tracker — home"
          className="flex flex-col items-center"
        >
          <DachshundLogo className="w-28 text-primary sm:w-32" />
          <span className="mt-1 font-display text-xl font-semibold tracking-tight">
            Ampi&rsquo;s Book Tracker
          </span>
        </Link>
      </div>
      {children}
    </div>
  );
}
