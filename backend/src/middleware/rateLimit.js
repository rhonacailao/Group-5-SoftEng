import { rateLimit } from 'express-rate-limit';

// Slows down people who hammer a public form (password guessing, email spam).
// By default: at most 10 requests per 15 minutes per IP address for the routes using it.
export function strictLimiter() {
  return rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 10,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    message: { ok: false, message: 'Too many attempts. Please try again in a few minutes.' },
    skip: () => process.env.NODE_ENV === 'test', // the automated tests would hit the limit
  });
}
