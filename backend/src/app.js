import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import healthRoutes from './routes/health.routes.js';
import authRoutes from './routes/auth.routes.js';
import userRoutes from './routes/user.routes.js';
import rightsRoutes from './routes/rights.routes.js';
import menuRoutes from './routes/menu.routes.js';
import { notFound, errorHandler } from './middleware/errorHandler.js';

const app = express();

app.use(helmet()); // safe default security headers
app.use(
  cors({
    origin: process.env.FRONTEND_URL || 'http://localhost:5173', // only our frontend may call the API
    credentials: true,                                           // lets the browser send the login cookie
  }),
);
app.use(express.json({ limit: '100kb' })); // lets the server read JSON sent by forms
app.use(cookieParser());                   // fills req.cookies

app.use('/api/health', healthRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/rights', rightsRoutes);
app.use('/api/menu', menuRoutes);

app.use(notFound);     // must stay after all routes
app.use(errorHandler); // must be the very last one

export default app;
