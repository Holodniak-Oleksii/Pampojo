CREATE TABLE "schedule_rule" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"workout_id" uuid NOT NULL,
	"start_date" date NOT NULL,
	"end_date" date,
	"weekdays" smallint[] DEFAULT '{}'::smallint[] NOT NULL,
	"interval_weeks" smallint DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "schedule_rule_interval" CHECK ("schedule_rule"."interval_weeks" between 1 and 4),
	CONSTRAINT "schedule_rule_weekdays" CHECK ("schedule_rule"."weekdays" <@ '{1,2,3,4,5,6,7}'::smallint[]),
	CONSTRAINT "schedule_rule_end" CHECK ("schedule_rule"."end_date" is null or ("schedule_rule"."end_date" >= "schedule_rule"."start_date"
        and "schedule_rule"."end_date" <= "schedule_rule"."start_date" + interval '2 years')),
	CONSTRAINT "schedule_rule_one_off" CHECK (cardinality("schedule_rule"."weekdays") > 0 or "schedule_rule"."end_date" = "schedule_rule"."start_date")
);
--> statement-breakpoint
ALTER TABLE "schedule_rule" ADD CONSTRAINT "schedule_rule_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "schedule_rule" ADD CONSTRAINT "schedule_rule_workout_id_workout_id_fk" FOREIGN KEY ("workout_id") REFERENCES "public"."workout"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "schedule_rule_user_active_idx" ON "schedule_rule" USING btree ("user_id","deleted_at","end_date");--> statement-breakpoint
CREATE INDEX "schedule_rule_workout_idx" ON "schedule_rule" USING btree ("workout_id");