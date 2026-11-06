import { Router } from 'express';
import * as users from '../controllers/user.controller.js';
import { requireAuth, requireRole } from '../middleware/auth.js';

const router = Router();

// S1-DEV-05: everything here needs a logged-in admin or superadmin.
// (What an admin may do to WHOM is decided in services/userAccess.js.)
router.use(requireAuth, requireRole('admin', 'superadmin'));

router.get('/', users.list);
router.post('/', users.create);
router.get('/:id', users.get);
router.patch('/:id', users.update);
router.patch('/:id/block', users.block);
router.patch('/:id/unblock', users.unblock);
router.post('/:id/resend-invite', users.resendInvite);

// S1-DEV-06: superadmin only (an admin gets 403)
router.patch('/:id/approve', requireRole('superadmin'), users.approve);
router.patch('/:id/role', requireRole('superadmin'), users.setRole);

export default router;
