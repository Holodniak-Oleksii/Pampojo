CREATE TABLE "set_log" (
	"id" uuid PRIMARY KEY NOT NULL,
	"session_id" uuid NOT NULL,
	"session_exercise_id" uuid NOT NULL,
	"exercise_id" uuid NOT NULL,
	"substituted_from_exercise_id" uuid,
	"set_index" smallint NOT NULL,
	"weight_kg" numeric(5, 2),
	"reps" smallint,
	"duration_sec" integer,
	"distance_m" integer,
	"rpe" numeric(3, 1),
	"completed_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "set_log_index" CHECK ("set_log"."set_index" between 0 and 19),
	CONSTRAINT "set_log_weight" CHECK ("set_log"."weight_kg" between 0 and 500),
	CONSTRAINT "set_log_reps" CHECK ("set_log"."reps" between 1 and 100),
	CONSTRAINT "set_log_duration" CHECK ("set_log"."duration_sec" between 1 and 3600),
	CONSTRAINT "set_log_distance" CHECK ("set_log"."distance_m" between 1 and 100000)
);
--> statement-breakpoint
CREATE TABLE "workout_session" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"workout_id" uuid,
	"scheduled_for" date,
	"workout_snapshot" jsonb NOT NULL,
	"exercises" jsonb NOT NULL,
	"status" text NOT NULL,
	"started_at" timestamp with time zone NOT NULL,
	"finished_at" timestamp with time zone,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "workout_session_status" CHECK ("workout_session"."status" in ('in_progress', 'completed', 'abandoned')),
	CONSTRAINT "workout_session_finished" CHECK (("workout_session"."status" = 'completed') = ("workout_session"."finished_at" is not null)
        or "workout_session"."status" = 'abandoned'),
	CONSTRAINT "workout_session_notes_length" CHECK (char_length("workout_session"."notes") <= 1000)
);
--> statement-breakpoint
ALTER TABLE "set_log" ADD CONSTRAINT "set_log_session_id_workout_session_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."workout_session"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "set_log" ADD CONSTRAINT "set_log_exercise_id_exercise_id_fk" FOREIGN KEY ("exercise_id") REFERENCES "public"."exercise"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "set_log" ADD CONSTRAINT "set_log_substituted_from_exercise_id_exercise_id_fk" FOREIGN KEY ("substituted_from_exercise_id") REFERENCES "public"."exercise"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workout_session" ADD CONSTRAINT "workout_session_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workout_session" ADD CONSTRAINT "workout_session_workout_id_workout_id_fk" FOREIGN KEY ("workout_id") REFERENCES "public"."workout"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "set_log_session_idx" ON "set_log" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX "set_log_exercise_idx" ON "set_log" USING btree ("exercise_id");--> statement-breakpoint
CREATE UNIQUE INDEX "set_log_position_uq" ON "set_log" USING btree ("session_id","session_exercise_id","set_index") WHERE "set_log"."deleted_at" is null;--> statement-breakpoint
CREATE INDEX "workout_session_user_status_idx" ON "workout_session" USING btree ("user_id","status","started_at");--> statement-breakpoint
CREATE INDEX "workout_session_user_updated_idx" ON "workout_session" USING btree ("user_id","updated_at");--> statement-breakpoint
CREATE INDEX "workout_session_workout_id_idx" ON "workout_session" USING btree ("workout_id");