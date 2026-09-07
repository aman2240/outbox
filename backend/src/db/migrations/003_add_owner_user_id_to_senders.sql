ALTER TABLE senders ADD COLUMN IF NOT EXISTS owner_user_id uuid REFERENCES users(id);
