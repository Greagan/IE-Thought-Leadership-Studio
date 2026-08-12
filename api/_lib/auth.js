export async function requireUser(req) { return { email: "team@imprintengine.com", name: "Team" }; }
export async function isApprover() { return false; }
export function send(res, status, obj) { res.status(status).json(obj); }
