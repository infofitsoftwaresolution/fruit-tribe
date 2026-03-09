-- Add require_password_change flag so we can force first-time password changes
ALTER TABLE "users"
ADD COLUMN IF NOT EXISTS "require_password_change" BOOLEAN NOT NULL DEFAULT false;

