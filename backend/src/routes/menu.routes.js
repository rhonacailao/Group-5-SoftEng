import { Router } from 'express';
import { getMenu } from '../controllers/menu.controller.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

router.get('/', requireAuth, getMenu); // S1-DEV-08: sidebar and module tiles for the logged-in user

export default router;
