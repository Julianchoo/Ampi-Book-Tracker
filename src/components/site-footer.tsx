import { PawPrint } from "@/components/dachshund";

export function SiteFooter() {
  return (
    <footer className="mt-12 border-t" role="contentinfo">
      <div className="container mx-auto flex items-center justify-center gap-2 px-4 py-6 text-xs text-muted-foreground sm:px-6">
        <PawPrint className="size-3.5 text-primary/50" />
        <span>Ampi&rsquo;s Book Tracker &mdash; read more, forget less.</span>
      </div>
    </footer>
  );
}
