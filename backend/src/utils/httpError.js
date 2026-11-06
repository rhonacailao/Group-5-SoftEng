// An error that carries an HTTP status code. Throw it anywhere; the error handler in
// middleware/errorHandler.js turns it into a JSON reply.
//   throw new HttpError(404, 'User not found')
//   throw new HttpError(400, 'Check the form', { errors: { email: 'Enter a valid email' } })
export class HttpError extends Error {
  constructor(status, message, { errors, code } = {}) {
    super(message);
    this.status = status; // 400 bad input, 401 not logged in, 403 not allowed, 404 not found, 409 conflict
    this.errors = errors; // optional: messages per form field
    this.code = code;     // optional: short machine-readable label such as TOKEN_EXPIRED
  }
}
