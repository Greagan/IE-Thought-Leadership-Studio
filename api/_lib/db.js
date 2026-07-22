// Neon Postgres client (serverless-friendly, HTTP-based).
// Requires the DATABASE_URL environment variable (your Neon connection string).
import { neon } from "@neondatabase/serverless";

if (!process.env.DATABASE_URL) {
  // Surfaced clearly at call time rather than crashing import.
  console.warn("DATABASE_URL is not set — database calls will fail until it is configured.");
}

export const sql = neon(process.env.DATABASE_URL || "");

// Append a row to the audit log. Never throws into the request path.
export async function audit(actor_email, action, entity, detail = "") {
  try {
    await sql`insert into audit_log (actor_email, action, entity, detail)
              values (${actor_email}, ${action}, ${entity}, ${detail})`;
  } catch (e) {
    console.warn("audit log failed:", e && e.message);
  }
}
