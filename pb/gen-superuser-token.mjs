// Generate a long-lived PocketBase superuser token for the app (.env PB_SUPERUSER_TOKEN).
// Usage: PB_URL=http://127.0.0.1:8091 PB_ADMIN_EMAIL=... PB_ADMIN_PASS=... node pb/gen-superuser-token.mjs
const PB_URL = process.env.PB_URL ?? "http://127.0.0.1:8091";
const EMAIL = process.env.PB_ADMIN_EMAIL;
const PASS = process.env.PB_ADMIN_PASS;
if (!EMAIL || !PASS) {
  console.error("Set PB_ADMIN_EMAIL and PB_ADMIN_PASS");
  process.exit(1);
}
const auth = await (await fetch(`${PB_URL}/api/collections/_superusers/auth-with-password`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ identity: EMAIL, password: PASS }),
})).json();
if (!auth.token) {
  console.error("Auth failed:", JSON.stringify(auth));
  process.exit(1);
}
const imp = await (await fetch(`${PB_URL}/api/collections/_superusers/impersonate/${auth.record.id}`, {
  method: "POST",
  headers: { "Content-Type": "application/json", Authorization: auth.token },
  body: JSON.stringify({ duration: 5 * 365 * 24 * 3600 }), // ~5 years
})).json();
if (!imp.token) {
  console.error("Impersonate failed:", JSON.stringify(imp));
  process.exit(1);
}
console.log("PB_SUPERUSER_TOKEN=" + imp.token);
