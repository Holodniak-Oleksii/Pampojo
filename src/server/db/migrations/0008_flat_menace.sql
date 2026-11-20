CREATE TABLE "sync_mutation" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"type" text NOT NULL,
	"applied_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sync_mutation_type" CHECK ("sync_mutation"."type" in ('session.put', 'session.patch', 'set.put', 'set.patch', 'set.delete', 'measurement.put', 'measurement.delete'))
);
--> statement-breakpoint
ALTER TABLE "sync_mutation" ADD CONSTRAINT "sync_mutation_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "sync_mutation_user_idx" ON "sync_mutation" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "exercise_owner_updated_idx" ON "exercise" USING btree ("owner_id","updated_at");--> statement-breakpoint
CREATE INDEX "body_measurement_user_updated_idx" ON "body_measurement" USING btree ("user_id","updated_at");--> statement-breakpoint
CREATE INDEX "set_log_session_updated_idx" ON "set_log" USING btree ("session_id","updated_at");--> statement-breakpoint
CREATE INDEX "schedule_rule_user_updated_idx" ON "schedule_rule" USING btree ("user_id","updated_at");