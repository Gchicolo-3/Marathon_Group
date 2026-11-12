// Who may sign in with Google. ALLOWED_EMAILS is a comma separated list set
// in Vercel (Mike's address, George's address). Addresses are compared
// lowercased. With nothing set, Google sign in is closed and only the
// password login works, so a stray Google account can never get in.
function allowedEmails() {
  return (process.env.ALLOWED_EMAILS || '')
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

function isAllowedEmail(email) {
  if (!email) return false;
  return allowedEmails().includes(String(email).trim().toLowerCase());
}

module.exports = { allowedEmails, isAllowedEmail };
