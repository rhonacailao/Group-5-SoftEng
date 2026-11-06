import { HttpError } from '../utils/httpError.js';

// Unknown URL
export function notFound(req, res) {
  res.status(404).json({ ok: false, message: 'Not found' });
}

// The one place where every error becomes a JSON reply. It needs all FOUR parameters:
// that is how Express knows this function is an error handler.
export function errorHandler(err, req, res, next) {
  if (res.headersSent) return next(err);

  if (err instanceof HttpError) {
    return res.status(err.status).json({ ok: false, message: err.message, errors: err.errors, code: err.code });
  }
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ ok: false, message: 'Invalid JSON' });
  }
  if (err.type === 'entity.too.large') {
    return res.status(413).json({ ok: false, message: 'Request is too large' });
  }

  // Database rules (see the error codes in Postgres)
  if (err.code === '23505') return res.status(409).json({ ok: false, message: 'That record already exists.' });
  if (err.code === '23503') return res.status(409).json({ ok: false, message: 'That record is linked to other data.' });
  if (err.code === '23514' || err.code === '22001') return res.status(400).json({ ok: false, message: 'Some values are not allowed.' });

  // Anything else is our bug: log it, but never show internals to the browser
  console.error(err);
  res.status(500).json({ ok: false, message: 'Something went wrong on the server.' });
}
