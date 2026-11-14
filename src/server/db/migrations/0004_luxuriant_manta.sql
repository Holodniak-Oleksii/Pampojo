CREATE TABLE "workout" (
	"id" uuid PRIMARY KEY NOT NULL,
	"owner_id" uuid NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"source_workout_id" uuid,
	"source_owner_name" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "workout_name_length" CHECK (char_length("workout"."name") between 1 and 80),
	CONSTRAINT "workout_description_length" CHECK (char_length("workout"."description") <= 500)
);
--> statement-breakpoint
CREATE TABLE "workout_exercise" (
	"id" uuid PRIMARY KEY NOT NULL,
	"workout_id" uuid NOT NULL,
	"exercise_id" uuid NOT NULL,
	"position" smallint NOT NULL,
	"target_sets" smallint,
	"target_reps_min" smallint,
	"target_reps_max" smallint,
	"target_weight_kg" numeric(5, 2),
	"target_duration_sec" integer,
	"target_distance_m" integer,
	"notes" text,
	CONSTRAINT "workout_exercise_sets" CHECK ("workout_exercise"."target_sets" between 1 and 20),
	CONSTRAINT "workout_exercise_reps" CHECK (("workout_exercise"."target_reps_min" is null) = ("workout_exercise"."target_reps_max" is null)
        and "workout_exercise"."target_reps_min" between 1 and 100
        and "workout_exercise"."target_reps_max" between "workout_exercise"."target_reps_min" and 100),
	CONSTRAINT "workout_exercise_weight" CHECK ("workout_exercise"."target_weight_kg" between 0 and 500),
	CONSTRAINT "workout_exercise_duration" CHECK ("workout_exercise"."target_duration_sec" between 5 and 3600),
	CONSTRAINT "workout_exercise_distance" CHECK ("workout_exercise"."target_distance_m" between 10 and 100000),
	CONSTRAINT "workout_exercise_notes_length" CHECK (char_length("workout_exercise"."notes") <= 300)
);
--> statement-breakpoint
ALTER TABLE "workout" ADD CONSTRAINT "workout_owner_id_user_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workout_exercise" ADD CONSTRAINT "workout_exercise_workout_id_workout_id_fk" FOREIGN KEY ("workout_id") REFERENCES "public"."workout"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workout_exercise" ADD CONSTRAINT "workout_exercise_exercise_id_exercise_id_fk" FOREIGN KEY ("exercise_id") REFERENCES "public"."exercise"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "workout_owner_updated_idx" ON "workout" USING btree ("owner_id","updated_at");--> statement-breakpoint
CREATE UNIQUE INDEX "workout_exercise_position_uq" ON "workout_exercise" USING btree ("workout_id","position");--> statement-breakpoint
CREATE INDEX "workout_exercise_exercise_id_idx" ON "workout_exercise" USING btree ("exercise_id");