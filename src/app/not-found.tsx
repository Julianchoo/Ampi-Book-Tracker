import Link from "next/link";
import { DachshundSleeping } from "@/components/dachshund";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="container mx-auto px-4 py-14">
      <div className="mx-auto flex max-w-md flex-col items-center text-center">
        <DachshundSleeping className="w-52 text-primary/50" />
        <h1 className="mt-4 font-display text-3xl font-bold">
          Nothing on this shelf
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          That page doesn&rsquo;t exist, or the book was taken off the shelf.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <Button asChild>
            <Link href="/">Go home</Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href="/library">My library</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
