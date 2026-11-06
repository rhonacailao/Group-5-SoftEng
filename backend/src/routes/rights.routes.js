import { Router } from 'express';
import * as users from '../controllers/user.controller.js';
import { requireAuth, requireRole } from '../middleware/auth.js';

const router = Router();

// S1-DEV-07: every right grouped by module (what the Rights dialog draws its checkboxes from)
router.get('/', requireAuth, requireRole('admin', 'superadmin'), users.catalogue);

export default router;
