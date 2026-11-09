CREATE TABLE "body_measurement" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"type" text NOT NULL,
	"value" numeric(7, 2) NOT NULL,
	"measured_on" date NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "body_measurement_type" CHECK ("body_measurement"."type" in ('weight', 'chest', 'waist', 'hips', 'biceps_left', 'biceps_right', 'thigh_left', 'thigh_right', 'body_fat_pct')),
	CONSTRAINT "body_measurement_value_positive" CHECK ("body_measurement"."value" > 0)
);
--> statement-breakpoint
CREATE TABLE "profile" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"display_name" text NOT NULL,
	"avatar_emoji" text NOT NULL,
	"avatar_color" smallint NOT NULL,
	"sex" text NOT NULL,
	"birth_date" date NOT NULL,
	"height_cm" numeric(4, 1) NOT NULL,
	"unit_system" text DEFAULT 'metric' NOT NULL,
	"time_zone" text NOT NULL,
	"onboarding_completed_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "profile_display_name_length" CHECK (char_length("profile"."display_name") between 1 and 40),
	CONSTRAINT "profile_avatar_emoji" CHECK ("profile"."avatar_emoji" in ('fox', 'bear', 'panda', 'koala', 'tiger', 'lion', 'frog', 'monkey', 'penguin', 'owl', 'octopus', 'unicorn', 'peach', 'orange', 'lemon', 'watermelon', 'avocado', 'cherries', 'weightlifter', 'boxing-glove', 'cyclist', 'runner', 'lightning', 'fire')),
	CONSTRAINT "profile_avatar_color" CHECK ("profile"."avatar_color" between 1 and 8),
	CONSTRAINT "profile_sex" CHECK ("profile"."sex" in ('male', 'female')),
	CONSTRAINT "profile_height_cm" CHECK ("profile"."height_cm" between 100 and 250),
	CONSTRAINT "profile_unit_system" CHECK ("profile"."unit_system" in ('metric', 'imperial'))
);
--> statement-breakpoint
ALTER TABLE "body_measurement" ADD CONSTRAINT "body_measurement_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "profile" ADD CONSTRAINT "profile_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "body_measurement_user_type_date_idx" ON "body_measurement" USING btree ("user_id","type","measured_on");