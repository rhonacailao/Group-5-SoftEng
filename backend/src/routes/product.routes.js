import { Router } from 'express';
import * as products from '../controllers/product.controller.js';
import { requireAuth } from '../middleware/auth.js';
import { requirePermission } from '../middleware/permission.js';

const router = Router();

// Everything here needs a login. What each route needs on top is a product right.
router.use(requireAuth);

// S2-DEV-04: who may OPEN the product screen?
// The main page (S1-DEV-08) shows the Product tile to anyone holding at least one right in the
// Product module. That module has six: Add / Edit / Delete product and Add / Edit / Delete price.
// Reading follows the same rule: at least ONE of them, or superadmin. A person who may only
// manage prices still has to find the product first. The check runs on the server and asks the
// database every time, so removing a right takes effect on the next request.
const PRODUCT_ACCESS = [
  'PRODUCT_ADD',
  'PRODUCT_EDIT',
  'PRODUCT_DELETE',
  'PRICE_ADD',
  'PRICE_EDIT',
  'PRICE_DELETE',
];

router.get('/', requirePermission(...PRODUCT_ACCESS), products.list);

// S2-DEV-05: Add and Edit each need their own right (per-action check)
router.post('/', requirePermission('PRODUCT_ADD'), products.create);
router.get('/:prodCode', requirePermission(...PRODUCT_ACCESS), products.get);
router.patch('/:prodCode', requirePermission('PRODUCT_EDIT'), products.update);

export default router;
