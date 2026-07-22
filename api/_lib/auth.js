// Google sign-in verification, restricted to your Workspace domain.
// The browser signs in with Google and sends the resulting ID token as:
//   Authorization: Bearer <id_token>
// We verify the token's signature + audience with Google, then require the
// email to be verified and to belong to ALLOWED_DOMAIN (default imprintengine.com).
//
// Required env vars: GOOGLE_CLIENT_ID. Optional: ALLOWED_DOMAIN.
import { OAuth2Client } from "google-auth-library";
import { sql } from "./db.js";

const client = new OAuth2Client();

// Throws { status, message } on any failure; returns the user on success.
export async function requireUser(req) {
  const header = req.headers.authorization || req.headers.Authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  if (!token) throw { status: 401, message: "Sign in required." };

  const clientId = process.env.GOOGLE_CLIENT_ID;
  if (!clientId) throw { status: 500, message: "Server not configured: GOOGLE_CLIENT_ID missing." };

  let payload;
  try {
    const ticket = await client.verifyIdToken({ idToken: token, audience: clientId });
    payload = ticket.getPayload();
  } catch (e) {
    throw { status: 401, message: "Your sign-in session is invalid or expired. Sign in again." };
  }

  const domain = (process.env.ALLOWED_DOMAIN || "imprintengine.com").toLowerCase();
  const email = (payload.email || "").toLowerCase();
  if (!payload.email_verified || !email.endsWith("@" + domain)) {
    throw { status: 403, message: "Access is limited to " + domain + " accounts." };
  }
  return { email, name: payload.name || email, picture: payload.picture || "" };
}

// Is this signed-in user allowed to approve drafts?
export async function isApprover(email) {
  try {
    const rows = await sql`select 1 from approvers where email = ${email.toLowerCase()} limit 1`;
    return rows.length > 0;
  } catch (e) {
    return false;
  }
}

// Small helper for endpoints to send JSON.
export function send(res, status, obj) {
  res.status(status).json(obj);
}
