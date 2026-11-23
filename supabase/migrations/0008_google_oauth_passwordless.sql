-- ECONOVA PostgreSQL / Supabase Migration 0008:
-- Allow passwordless accounts for Google OAuth sign-in with subsequent password linking.
ALTER TABLE users ALTER COLUMN password_hash DROP NOT NULL;
ALTER TABLE users ALTER COLUMN password_hash SET DEFAULT NULL;
