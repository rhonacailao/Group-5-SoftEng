import * as authService from '../services/auth.service.js';
import { SESSION_COOKIE } from '../middleware/auth.js';

// A controller only reads the request, calls a service, and sends the reply.
// The rules (validation, who is allowed) live in the services.

function cookieOptions() {
  return {
    httpOnly: true,                                  // JavaScript in the page cannot read it
    sameSite: 'lax',                                 // not sent along with requests from other sites
    secure: process.env.NODE_ENV === 'production',   // https only when deployed
    maxAge: authService.sessionHours() * 60 * 60 * 1000,
    path: '/',
  };
}

export async function register(req, res) {
  await authService.register(req.body ?? {}); // Express 5: req.body is undefined if no JSON was sent
  res.status(201).json({ ok: true, message: 'Registration submitted. Please wait for approval.' });
}

export async function login(req, res) {
  const { token, user } = await authService.login(req.body ?? {});
  res.cookie(SESSION_COOKIE, token, cookieOptions());
  res.json({ ok: true, user });
}

export async function logout(req, res) {
  await authService.logout(req.cookies?.[SESSION_COOKIE]);
  res.clearCookie(SESSION_COOKIE, { ...cookieOptions(), maxAge: undefined });
  res.json({ ok: true });
}

// Who am I? The main page calls this when it loads.
export function me(req, res) {
  res.json({ ok: true, user: authService.toPublicUser(req.user) });
}

export async function forgotPassword(req, res) {
  await authService.requestPasswordReset((req.body ?? {}).email);
  // Same answer whether or not the email exists
  res.json({ ok: true, message: 'If an account exists for that email, a reset link is on its way.' });
}

export async function setPassword(req, res) {
  const { purpose } = await authService.setPasswordWithToken(req.body ?? {});
  res.json({ ok: true, purpose, message: 'Password saved. You can now log in.' });
}
