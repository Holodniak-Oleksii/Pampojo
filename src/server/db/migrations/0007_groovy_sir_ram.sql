ALTER TABLE "body_measurement" DROP CONSTRAINT "body_measurement_type";--> statement-breakpoint
DROP INDEX "body_measurement_user_type_date_idx";--> statement-breakpoint
-- Keep the newest live row per user, type and day; the unique index below needs it.
UPDATE "body_measurement" b SET "deleted_at" = now(), "updated_at" = now()
WHERE b."deleted_at" IS NULL AND EXISTS (
  SELECT 1 FROM "body_measurement" n
  WHERE n."user_id" = b."user_id" AND n."type" = b."type" AND n."measured_on" = b."measured_on"
    AND n."deleted_at" IS NULL
    AND (n."created_at", n."id") > (b."created_at", b."id")
);--> statement-breakpoint
CREATE UNIQUE INDEX "body_measurement_user_type_day_uq" ON "body_measurement" USING btree ("user_id","type","measured_on") WHERE "body_measurement"."deleted_at" is null;--> statement-breakpoint
ALTER TABLE "body_measurement" ADD CONSTRAINT "body_measurement_type" CHECK ("body_measurement"."type" in ('weight', 'neck', 'shoulders', 'chest', 'waist', 'hips', 'biceps_left', 'biceps_right', 'forearm_left', 'forearm_right', 'thigh_left', 'thigh_right', 'calf_left', 'calf_right', 'body_fat_pct'));
