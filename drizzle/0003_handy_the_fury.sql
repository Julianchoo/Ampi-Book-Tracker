ALTER TABLE "book" ADD COLUMN "description" text;--> statement-breakpoint
ALTER TABLE "book" ADD COLUMN "source" text DEFAULT 'openlibrary' NOT NULL;