CREATE TABLE "gym_profile" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"equipment" text[] NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "gym_profile_equipment" CHECK ("gym_profile"."equipment" <@ array['barbell', 'ez_bar', 'trap_bar', 'dumbbells', 'kettlebells', 'weight_plates', 'flat_bench', 'adjustable_bench', 'decline_bench', 'squat_rack', 'preacher_bench', 'back_extension_bench', 'glute_ham_bench', 'pull_up_bar', 'dip_station', 'captains_chair', 'smith_machine', 'chest_press_machine', 'shoulder_press_machine', 'pec_deck', 'row_machine', 't_bar_row', 'triceps_machine', 'biceps_machine', 'ab_crunch_machine', 'leg_press', 'hack_squat', 'leg_extension', 'leg_curl', 'hip_abduction_adduction', 'calf_raise_machine', 'reverse_hyper', 'cable_station', 'cable_crossover', 'pulldown_row_station', 'resistance_bands', 'ab_wheel', 'stability_ball']::text[])
);
--> statement-breakpoint
ALTER TABLE "exercise" ADD COLUMN "gym_equipment" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "gym_profile" ADD CONSTRAINT "gym_profile_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exercise" ADD CONSTRAINT "exercise_gym_equipment_array" CHECK (jsonb_typeof("exercise"."gym_equipment") = 'array');