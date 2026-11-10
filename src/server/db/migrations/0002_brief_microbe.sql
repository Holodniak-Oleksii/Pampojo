CREATE TABLE "exercise" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" uuid,
	"slug" text,
	"primary_muscles" text[] NOT NULL,
	"secondary_muscles" text[] DEFAULT '{}'::text[] NOT NULL,
	"movement_pattern" text,
	"equipment" text[] NOT NULL,
	"mechanic" text,
	"laterality" text,
	"tracking_type" text NOT NULL,
	"difficulty" smallint,
	"popularity" smallint,
	"media" jsonb DEFAULT '{"frames":[]}'::jsonb NOT NULL,
	"source_exercise_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "exercise_primary_muscles_present" CHECK (cardinality("exercise"."primary_muscles") >= 1),
	CONSTRAINT "exercise_primary_muscles" CHECK ("exercise"."primary_muscles" <@ array['chest', 'shoulders', 'triceps', 'biceps', 'forearms', 'lats', 'middle_back', 'traps', 'lower_back', 'abdominals', 'glutes', 'quadriceps', 'hamstrings', 'adductors', 'abductors', 'calves', 'neck']::text[]),
	CONSTRAINT "exercise_secondary_muscles" CHECK ("exercise"."secondary_muscles" <@ array['chest', 'shoulders', 'triceps', 'biceps', 'forearms', 'lats', 'middle_back', 'traps', 'lower_back', 'abdominals', 'glutes', 'quadriceps', 'hamstrings', 'adductors', 'abductors', 'calves', 'neck']::text[]),
	CONSTRAINT "exercise_equipment_present" CHECK (cardinality("exercise"."equipment") >= 1),
	CONSTRAINT "exercise_equipment" CHECK ("exercise"."equipment" <@ array['barbell', 'ez_bar', 'dumbbell', 'kettlebell', 'cable', 'machine', 'bodyweight', 'band', 'other']::text[]),
	CONSTRAINT "exercise_movement_pattern" CHECK ("exercise"."movement_pattern" in ('horizontal_push', 'vertical_push', 'horizontal_pull', 'vertical_pull', 'squat', 'hinge', 'lunge', 'carry', 'core', 'isolation')),
	CONSTRAINT "exercise_mechanic" CHECK ("exercise"."mechanic" in ('compound', 'isolation')),
	CONSTRAINT "exercise_laterality" CHECK ("exercise"."laterality" in ('bilateral', 'unilateral')),
	CONSTRAINT "exercise_tracking_type" CHECK ("exercise"."tracking_type" in ('weight_reps', 'reps', 'time', 'distance')),
	CONSTRAINT "exercise_difficulty" CHECK ("exercise"."difficulty" between 1 and 3),
	CONSTRAINT "exercise_popularity" CHECK ("exercise"."popularity" between 1 and 100)
);
--> statement-breakpoint
CREATE TABLE "exercise_translation" (
	"exercise_id" uuid NOT NULL,
	"locale" text NOT NULL,
	"name" text NOT NULL,
	"aliases" text[] DEFAULT '{}'::text[] NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"instructions" text[] DEFAULT '{}'::text[] NOT NULL,
	"common_mistakes" text[] DEFAULT '{}'::text[] NOT NULL,
	"search_name" text NOT NULL,
	"search_aliases" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "exercise_translation_exercise_id_locale_pk" PRIMARY KEY("exercise_id","locale"),
	CONSTRAINT "exercise_translation_locale" CHECK ("exercise_translation"."locale" in ('en', 'uk')),
	CONSTRAINT "exercise_translation_name_length" CHECK (char_length("exercise_translation"."name") between 1 and 80)
);
--> statement-breakpoint
ALTER TABLE "exercise" ADD CONSTRAINT "exercise_owner_id_user_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exercise" ADD CONSTRAINT "exercise_source_exercise_id_exercise_id_fk" FOREIGN KEY ("source_exercise_id") REFERENCES "public"."exercise"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exercise_translation" ADD CONSTRAINT "exercise_translation_exercise_id_exercise_id_fk" FOREIGN KEY ("exercise_id") REFERENCES "public"."exercise"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "exercise_owner_id_idx" ON "exercise" USING btree ("owner_id");--> statement-breakpoint
CREATE INDEX "exercise_source_exercise_id_idx" ON "exercise" USING btree ("source_exercise_id");--> statement-breakpoint
CREATE UNIQUE INDEX "exercise_system_slug_uq" ON "exercise" USING btree ("slug") WHERE "exercise"."owner_id" is null;