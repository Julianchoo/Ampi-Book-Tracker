CREATE TABLE "book" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"ol_key" text NOT NULL,
	"title" text NOT NULL,
	"author" text,
	"cover_id" integer,
	"first_publish_year" integer,
	"pages" integer,
	"language" text,
	"subjects" text[],
	"shelf" text NOT NULL,
	"status" text,
	"rating" real,
	"started_at" date,
	"finished_at" date,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "book" ADD CONSTRAINT "book_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "book_user_shelf_idx" ON "book" USING btree ("user_id","shelf");--> statement-breakpoint
CREATE UNIQUE INDEX "book_user_ol_key_idx" ON "book" USING btree ("user_id","ol_key");