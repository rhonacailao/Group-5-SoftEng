import { Router } from 'express';
import * as auth from '../controllers/auth.controller.js';
import { requireAuth } from '../middleware/auth.js';
import { strictLimiter } from '../middleware/rateLimit.js';

const router = Router();
const limiter = strictLimiter();

router.post('/register', limiter, auth.register);        // S1-DEV-02
router.post('/login', limiter, auth.login);              // S1-DEV-03
router.post('/logout', auth.logout);                     // S1-DEV-03
router.get('/me', requireAuth, auth.me);                 // who is logged in?
router.post('/set-password', limiter, auth.setPassword); // S1-DEV-03: first password (emailed link)
router.post('/forgot-password', limiter, auth.forgotPassword); // S1-DEV-04: ask for the email
router.post('/reset-password', limiter, auth.setPassword);     // S1-DEV-04: same handler, name used in the sheet

export default router;
