import * as rightsRepo from '../repositories/rights.repository.js';
import { HttpError } from '../utils/httpError.js';

// S1-DEV-08: the server-side permission check. Put it on any route that belongs to a module,
// AFTER requireAuth:
//
//   router.post('/customers', requireAuth, requirePermission('CUSTOMER_ADD'), createCustomer);
//   router.get('/jobs/:id/history', requireAuth, requirePermission('JOB_HISTORY_VIEW'), ...);
//
// Give it several codes and the user needs AT LEAST ONE of them.
//   - superadmin: always allowed (they implicitly hold every right)
//   - admin and user: allowed only if the right was granted to them in the Rights dialog.
//     Being an admin gives NO module rights; admins manage users, not customers or sales.
// The database is asked on every request, so taking a right away stops working at once, and
// hiding a button in the browser is never the only protection.
export function requirePermission(...codes) {
  if (codes.length === 0 || codes.some((code) => typeof code !== 'string' || code.trim() === '')) {
    // A typo here is a programming mistake, so fail loudly when the server starts
    throw new Error('requirePermission needs one or more right codes, e.g. requirePermission("CUSTOMER_ADD")');
  }

  return async function checkPermission(req, res, next) {
    if (!req.user) throw new HttpError(401, 'Please log in.'); // requireAuth was forgotten or failed
    if (req.user.role === 'superadmin') return next();

    if (!(await rightsRepo.userHasAnyRight(req.user.id, codes))) {
      throw new HttpError(403, 'You do not have permission to do this.', { code: 'FORBIDDEN' });
    }
    next();
  };
}
