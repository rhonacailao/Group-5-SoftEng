export function register(req, res) {
  // Express 5 leaves req.body undefined if no JSON arrived, so fall back to {}
  const body = req.body ?? {};

  // Take ONLY these three fields. Anything extra (like "role") is ignored.
  const firstName = String(body.firstName ?? '').trim();
  const lastName = String(body.lastName ?? '').trim();
  const email = String(body.email ?? '').trim().toLowerCase();

  const errors = {};
  if (!firstName) errors.firstName = 'First name is required';
  if (!lastName) errors.lastName = 'Last name is required';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.email = 'Enter a valid email';

  if (Object.keys(errors).length > 0) {
    return res.status(400).json({ ok: false, errors });
  }

  // TODO after Karla's migration: INSERT with role 'user' and status 'pending'
  return res.status(501).json({ ok: false, message: 'Not implemented yet' });
}