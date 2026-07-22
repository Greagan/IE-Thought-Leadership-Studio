// Public config for the front-end (no secrets here — the Google client ID is
// not sensitive). Lets the HTML stay deploy-agnostic instead of hardcoding it.
export default function handler(req, res) {
  res.status(200).json({
    googleClientId: process.env.GOOGLE_CLIENT_ID || "",
    allowedDomain: process.env.ALLOWED_DOMAIN || "imprintengine.com"
  });
}
