CREATE TABLE "book_collection" (
	"book_id" uuid NOT NULL,
	"collection_id" uuid NOT NULL,
	CONSTRAINT "book_collection_book_id_collection_id_pk" PRIMARY KEY("book_id","collection_id")
);
--> statement-breakpoint
CREATE TABLE "collection" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "book" ADD COLUMN "ol_rating" real;--> statement-breakpoint
ALTER TABLE "book" ADD COLUMN "ol_rating_count" integer;--> statement-breakpoint
ALTER TABLE "book" ADD COLUMN "ol_rating_checked_at" timestamp;--> statement-breakpoint
ALTER TABLE "book_collection" ADD CONSTRAINT "book_collection_book_id_book_id_fk" FOREIGN KEY ("book_id") REFERENCES "public"."book"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "book_collection" ADD CONSTRAINT "book_collection_collection_id_collection_id_fk" FOREIGN KEY ("collection_id") REFERENCES "public"."collection"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "collection" ADD CONSTRAINT "collection_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "book_collection_collection_idx" ON "book_collection" USING btree ("collection_id");--> statement-breakpoint
CREATE UNIQUE INDEX "collection_user_name_idx" ON "collection" USING btree ("user_id",lower("name"));