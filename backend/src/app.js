import express from 'express';
import cors from 'cors';
import healthRoutes from './routes/health.routes.js';

const app = express();

app.use(cors());          // lets the frontend (port 5173) call this API (port 3000)
app.use(express.json());  // lets the server read JSON sent by forms (needed for login later)
app.use('/api/health', healthRoutes); // every route in that file starts with /api/health

export default app;