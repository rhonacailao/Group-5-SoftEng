import * as users from '../repositories/user.repository.js';
import { HttpError } from '../utils/httpError.js';

// The "who may touch whom" rules for S1-DEV-05 (and 06 / 07 later), kept in one place:
//   superadmin -> can manage everyone
//   admin      -> can manage plain users only, and never even sees superadmins
//   user       -> cannot manage anyone
export function canManage(actor, target) {
  if (actor.role === 'superadmin') return true;
  return actor.role === 'admin' && target.role === 'user';
}

export function assertCanManage(actor, target) {
  if (!canManage(actor, target)) {
    throw new HttpError(403, 'Admins can only manage users.');
  }
}

// Finds a user for a read-only request. To an admin a superadmin does not exist (404).
export async function loadTarget(actor, id, db) {
  const target = await users.findById(id, db);
  if (!target || (target.role === 'superadmin' && actor.role !== 'superadmin')) {
    throw new HttpError(404, 'User not found');
  }
  return target;
}

// Same, for a request that changes data: the user row is locked until the transaction ends.
// For a superadmin we first lock ALL active superadmins (always in the same order), so two
// people can never remove the last two superadmins at the same time.
export async function loadTargetLocked(actor, id, db) {
  const peek = await loadTarget(actor, id, db);
  const activeSuperadmins = peek.role === 'superadmin' ? await users.lockActiveSuperadmins(db) : [];
  const target = await users.findByIdForUpdate(id, db);
  if (target.role !== peek.role) {
    throw new HttpError(409, 'This user was just changed by someone else. Please reload and try again.');
  }
  return { target, activeSuperadmins };
}

// S1-DEV-06: the last working superadmin can never be blocked or demoted
export function assertNotLastSuperadmin(target, activeSuperadmins) {
  const isActiveSuperadmin = target.role === 'superadmin' && activeSuperadmins.includes(target.id);
  if (isActiveSuperadmin && activeSuperadmins.length <= 1) {
    throw new HttpError(409, 'You cannot remove or disable the last remaining superadmin.', { code: 'LAST_SUPERADMIN' });
  }
}
