"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { CalendarIcon, Check, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { StarRatingInput } from "@/components/books/star-rating";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { deleteBook, updateBook } from "@/lib/actions/books";
import { formatDate, STATUSES, STATUS_LABELS, type Status } from "@/lib/books";
import type { Book } from "@/lib/queries";

/** Date <-> "YYYY-MM-DD" in local time. `toISOString` would shift the day west of UTC. */
function toDateString(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function parseDateString(s: string | null): Date | undefined {
  if (!s) return undefined;
  const [y, m, d] = s.split("-").map(Number);
  return y && m && d ? new Date(y, m - 1, d) : undefined;
}

function DateField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string | null;
  onChange: (value: string | null) => void;
}) {
  const [open, setOpen] = React.useState(false);
  const selected = parseDateString(value);
  // One instance, so "after today" and the last selectable month agree.
  const today = React.useMemo(() => new Date(), []);

  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <div className="flex gap-1">
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              className="h-10 flex-1 justify-start font-normal"
            >
              <CalendarIcon className="size-4 text-muted-foreground" />
              {formatDate(value) ?? (
                <span className="text-muted-foreground">Pick a date</span>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="single"
              // Spread rather than pass undefined: exactOptionalPropertyTypes
              // treats an explicit `undefined` as a type error here.
              {...(selected ? { selected, defaultMonth: selected } : {})}
              autoFocus
              // Month and year dropdowns, not 30 clicks on the back chevron:
              // a book finished three years ago is two taps away.
              captionLayout="dropdown"
              startMonth={new Date(today.getFullYear() - 50, 0)}
              endMonth={today}
              disabled={{ after: today }}
              onSelect={(d) => {
                onChange(d ? toDateString(d) : null);
                setOpen(false);
              }}
            />
          </PopoverContent>
        </Popover>
        {value && (
          <Button
            variant="ghost"
            size="icon"
            className="size-10"
            aria-label={`Clear ${label.toLowerCase()}`}
            onClick={() => onChange(null)}
          >
            <Trash2 className="size-4" />
          </Button>
        )}
      </div>
    </div>
  );
}

export function BookDetailsForm({
  book,
  highlight = false,
}: {
  book: Book;
  /** Set just after adding a book, to draw the eye to the form. */
  highlight?: boolean;
}) {
  const router = useRouter();
  const [saving, setSaving] = React.useState(false);
  const [deleting, setDeleting] = React.useState(false);

  const [status, setStatus] = React.useState<Status | null>(
    (book.status as Status | null) ?? null
  );
  const [rating, setRating] = React.useState<number | null>(book.rating);
  const [startedAt, setStartedAt] = React.useState<string | null>(book.startedAt);
  const [finishedAt, setFinishedAt] = React.useState<string | null>(
    book.finishedAt
  );
  const [notes, setNotes] = React.useState(book.notes ?? "");

  const dirty =
    status !== ((book.status as Status | null) ?? null) ||
    rating !== book.rating ||
    startedAt !== book.startedAt ||
    finishedAt !== book.finishedAt ||
    notes !== (book.notes ?? "");

  // Dates crossing over is easy to do by accident and makes the stats lie.
  const datesInvalid =
    !!startedAt && !!finishedAt && finishedAt < startedAt;

  async function save() {
    if (datesInvalid) {
      toast.error("The finish date can't be before the start date.");
      return;
    }
    setSaving(true);
    const result = await updateBook(book.id, {
      status,
      rating,
      startedAt,
      finishedAt,
      notes: notes.trim() || null,
    });
    if (!result.ok) {
      setSaving(false);
      toast.error(result.error);
      return;
    }
    toast.success("Saved");
    // Back to whichever shelf the book ended up on — finishing a wishlist book
    // moves it, so `book.shelf` from the server render can already be stale.
    // `saving` deliberately stays true: the form is on its way out, and
    // re-enabling the button would flash a "Save changes" state that isn't.
    router.push(result.shelf === "wishlist" ? "/wishlist" : "/library");
  }

  return (
    <section
      className={
        highlight
          ? "animate-fade-up rounded-lg border-2 border-primary/40 bg-card p-4 shadow-sm sm:p-5"
          : "rounded-lg border bg-card p-4 shadow-sm sm:p-5"
      }
      aria-labelledby="your-reading-heading"
    >
      <h2
        id="your-reading-heading"
        className="font-display text-lg font-semibold"
      >
        Your reading
      </h2>
      {highlight && (
        <p className="mt-1 text-sm text-muted-foreground">
          Added to your library. Fill in whatever you like — all of it is optional.
        </p>
      )}

      <div className="mt-4 space-y-5">
        <div className="space-y-2">
          <Label>Your rating</Label>
          <StarRatingInput value={rating} onChange={setRating} />
        </div>

        <div className="space-y-2">
          <Label htmlFor="status">Status</Label>
          <Select
            value={status ?? "none"}
            onValueChange={(v) => setStatus(v === "none" ? null : (v as Status))}
          >
            <SelectTrigger id="status" className="h-10 w-full sm:w-56">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">No status</SelectItem>
              {STATUSES.map((s) => (
                <SelectItem key={s} value={s}>
                  {STATUS_LABELS[s]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <DateField label="Started" value={startedAt} onChange={setStartedAt} />
          <DateField
            label="Finished"
            value={finishedAt}
            onChange={(v) => {
              setFinishedAt(v);
              // A date in the Finished box means finished. Flip the dropdown
              // here rather than server-side so you can see it happen — and
              // can still override it before saving.
              if (v) setStatus("finished");
            }}
          />
        </div>
        {datesInvalid && (
          <p role="alert" className="text-sm text-destructive">
            The finish date can&rsquo;t be before the start date.
          </p>
        )}

        <div className="space-y-2">
          <Label htmlFor="notes">My notes</Label>
          <Textarea
            id="notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={5}
            placeholder="What stayed with you?"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button onClick={save} disabled={saving || !dirty || datesInvalid}>
            {saving ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Check className="size-4" />
            )}
            {dirty ? "Save changes" : "Saved"}
          </Button>

          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="ghost" className="ml-auto text-destructive">
                <Trash2 className="size-4" />
                Remove
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Remove this book?</AlertDialogTitle>
                <AlertDialogDescription>
                  “{book.title}” will be removed from your shelf, along with your
                  rating, dates and notes. This can&rsquo;t be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Keep it</AlertDialogCancel>
                <AlertDialogAction
                  disabled={deleting}
                  onClick={async (e) => {
                    e.preventDefault();
                    setDeleting(true);
                    const result = await deleteBook(book.id);
                    if (!result.ok) {
                      setDeleting(false);
                      toast.error(result.error);
                      return;
                    }
                    toast.success("Removed");
                    router.push(
                      book.shelf === "wishlist" ? "/wishlist" : "/library"
                    );
                  }}
                >
                  {deleting && <Loader2 className="size-4 animate-spin" />}
                  Remove
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>
    </section>
  );
}
