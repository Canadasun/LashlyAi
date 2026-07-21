import { pool } from "../db";

export type ClientNoteSource = "manual" | "voice";

export interface ClientNote {
  id: string;
  client_profile_id: string;
  text: string;
  source: ClientNoteSource;
  created_at: string;
}

export async function createClientNote(input: {
  clientProfileId: string;
  text: string;
  source: ClientNoteSource;
}): Promise<ClientNote> {
  const result = await pool.query<ClientNote>(
    `INSERT INTO client_notes (client_profile_id, text, source)
     VALUES ($1, $2, $3)
     RETURNING *`,
    [input.clientProfileId, input.text, input.source],
  );
  return result.rows[0];
}

export async function getClientNotesByClientProfileId(clientProfileId: string): Promise<ClientNote[]> {
  const result = await pool.query<ClientNote>(
    "SELECT * FROM client_notes WHERE client_profile_id = $1 ORDER BY created_at DESC",
    [clientProfileId],
  );
  return result.rows;
}
