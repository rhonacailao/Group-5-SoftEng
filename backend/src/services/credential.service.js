import * as tokens from '../repositories/token.repository.js';
import { newToken, hashToken } from '../utils/tokens.js';
import { sendMail } from '../config/mailer.js';

// How long each kind of one-time link stays valid
export const INVITE_HOURS = 72; // "set your password" link sent after approval
export const RESET_HOURS = 1;   // "forgot password" link

function frontendUrl() {
  return (process.env.FRONTEND_URL || 'http://localhost:5173').replace(/\/$/, '');
}

// Creates a one-time link for the user and returns the plain token.
// Only its hash is saved in the database, so this is the one moment the token exists.
// Call it inside a transaction (pass the client as `db`).
export async function createLink(db, user, purpose) {
  const token = newToken();
  await tokens.create(
    {
      userId: user.id,
      tokenHash: hashToken(token),
      purpose,
      hours: purpose === 'reset_password' ? RESET_HOURS : INVITE_HOURS,
    },
    db,
  );
  return token;
}

// Emails the link. A mail failure is logged but never breaks the request, because the
// account change is already saved; an admin can use "resend invite" afterwards.
// Returns true when the mail was handed to the mail server.
export async function emailLink(user, purpose, token) {
  const link = `${frontendUrl()}/set-password?token=${token}`;
  const isReset = purpose === 'reset_password';
  const hours = isReset ? RESET_HOURS : INVITE_HOURS;

  const subject = isReset ? 'Reset your HOPE ERP password' : 'Set your HOPE ERP password';
  const intro = isReset
    ? 'We received a request to reset your HOPE ERP password.'
    : 'Your HOPE ERP account has been approved.';
  const text =
    `Hi ${user.firstName},\n\n${intro}\n` +
    `Open this link to choose a password (it works once and expires in ${hours} hour${hours === 1 ? '' : 's'}):\n\n` +
    `${link}\n\n` +
    (isReset ? 'If you did not ask for this, you can ignore this email.\n' : '');

  try {
    await sendMail({ to: user.email, subject, text });
    return true;
  } catch (err) {
    console.error('Could not send email:', err.message);
    return false;
  }
}
