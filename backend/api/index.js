// Vercel entry point. Vercel runs the Express app as ONE serverless function for every
// request (vercel.json sends all paths here), so there is no app.listen() on Vercel.
// Locally you still use `npm run dev` (src/server.js).
import app from '../src/app.js';

export default app;
