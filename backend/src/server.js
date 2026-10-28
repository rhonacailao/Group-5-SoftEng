import 'dotenv/config'; // must be first so .env loads before db.js reads it
import app from './app.js';

const PORT = process.env.PORT || 3000; // || 3000 is the fallback if .env has no PORT

app.listen(PORT, () => {
  console.log(`API running on http://localhost:${PORT}`);
});