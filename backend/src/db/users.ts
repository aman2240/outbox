import { queryOne } from "./client";
import { User } from "../types";

export interface UpsertUserInput {
  google_id: string;
  name: string;
  email: string;
  avatar_url?: string | null;
}

export async function upsertUserByGoogleId(input: UpsertUserInput): Promise<User> {
  const row = await queryOne<User>(
    `INSERT INTO users (google_id, name, email, avatar_url)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (google_id) DO UPDATE SET
       name = EXCLUDED.name,
       email = EXCLUDED.email,
       avatar_url = EXCLUDED.avatar_url
     RETURNING *`,
    [input.google_id, input.name, input.email, input.avatar_url ?? null]
  );
  if (!row) throw new Error("Failed to upsert user");
  return row;
}

export async function getUserById(id: string): Promise<User | null> {
  return queryOne<User>("SELECT * FROM users WHERE id = $1", [id]);
}
