import { Router } from 'express';
import * as customers from '../controllers/customer.controller.js';
import { requireAuth } from '../middleware/auth.js';
import { requirePermission } from '../middleware/permission.js';

const router = Router();

// Everything here needs a login. What each route needs on top is the customer right for that action.
router.use(requireAuth);

// S2-DEV-01 / S2-DEV-02: who may OPEN the customer screens?
// The Rights dialog only has Add / Edit / Delete for the Customer module, and the main page
// (S1-DEV-08) shows the Customer tile to anyone holding at least one of them. Reading follows
// the same rule: at least ONE customer right, or superadmin. The check runs on the server and
// asks the database every time, so removing a right takes effect on the next request.
const CUSTOMER_ACCESS = ['CUSTOMER_ADD', 'CUSTOMER_EDIT', 'CUSTOMER_DELETE'];

router.get('/', requirePermission(...CUSTOMER_ACCESS), customers.list);

// S2-DEV-02: Add and Edit each need their own right (per-action check)
// Keep next-number ABOVE /:custNo, or "next-number" would be read as a customer number.
router.get('/next-number', requirePermission('CUSTOMER_ADD'), customers.nextNumber);
router.post('/', requirePermission('CUSTOMER_ADD'), customers.create);

router.get('/:custNo', requirePermission(...CUSTOMER_ACCESS), customers.get);
router.patch('/:custNo', requirePermission('CUSTOMER_EDIT'), customers.update);

// S2-DEV-03: soft delete and restore both need the Delete right (the Rights dialog has no
// separate Restore right).
router.delete('/:custNo', requirePermission('CUSTOMER_DELETE'), customers.remove);
router.patch('/:custNo/restore', requirePermission('CUSTOMER_DELETE'), customers.restore);

export default router;
