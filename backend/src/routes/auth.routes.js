import { Router } from 'express';
import { register } from '../controllers/auth.controller.js';

const router = Router();
router.post('/register', register); // POST because the request sends data to create something

export default router;