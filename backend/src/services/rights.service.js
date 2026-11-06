import { withTransaction } from '../config/db.js';
import * as rightsRepo from '../repositories/rights.repository.js';
import * as audit from '../repositories/audit.repository.js';
import { inDisplayOrder } from '../utils/rightsOrder.js';
import { loadTarget, loadTargetLocked, assertCanManage } from './userAccess.js';
import { HttpError } from '../utils/httpError.js';

const MAX_CODES = 200; // far more than the 36 that exist; just stops silly requests

function buildDialog(catalogue, held) {
  const modules = [];
  const byCode = new Map();
  for (const row of catalogue) {
    let module = byCode.get(row.moduleCode);
    if (!module) {
      module = { code: row.moduleCode, name: row.moduleName, rights: [] };
      byCode.set(row.moduleCode, module);
      modules.push(module);
    }
    module.rights.push({ code: row.rightCode, description: row.description, granted: held.has(row.rightCode) });
  }
  for (const module of modules) {
    const total = module.rights.length;
    const granted = module.rights.filter((right) => right.granted).length;
    module.total = total;
    module.grantedCount = granted;
    // What the module checkbox should show: ticked, empty, or half-ticked
    module.state = granted === 0 ? 'none' : granted === total ? 'all' : 'some';
  }
  return modules;
}

// The list of every right, grouped by module (for drawing the dialog before a user is picked)
export async function getCatalogue() {
  return buildDialog(inDisplayOrder(await rightsRepo.listCatalogue()), new Set());
}

// A superadmin always has every right (nothing to assign), so the dialog is for everyone else
function assertAssignable(target) {
  if (target.role === 'superadmin') {
    throw new HttpError(400, 'Superadmins always have every right. There is nothing to assign.');
  }
}

// S1-DEV-07: what the Rights dialog shows for one user
export async function getUserRights(actor, id) {
  const target = await loadTarget(actor, id);
  assertCanManage(actor, target);
  assertAssignable(target);
  const held = new Set(await rightsRepo.listGrantedCodes(target.id));
  return { user: { id: target.id, firstName: target.firstName, lastName: target.lastName, role: target.role }, modules: buildDialog(inDisplayOrder(await rightsRepo.listCatalogue()), held) };
}

// S1-DEV-07: the dialog's Save button. `codes` is the COMPLETE list of rights the user
// should have afterwards, so the dialog's module checkboxes and "All" / "None" are just
// different ways of building that list. Everything happens in one transaction: either all
// of the changes and their audit rows are saved, or none are.
export async function setUserRights(actor, id, codes) {
  if (!Array.isArray(codes) || codes.length > MAX_CODES || codes.some((code) => typeof code !== 'string')) {
    throw new HttpError(400, 'Send rights as a list of right codes.', { errors: { rights: 'Send rights as a list of right codes.' } });
  }
  const wanted = new Set(codes);

  return withTransaction(actor.email, async (db) => {
    const { target } = await loadTargetLocked(actor, id, db);
    assertCanManage(actor, target);
    assertAssignable(target);

    const catalogue = inDisplayOrder(await rightsRepo.listCatalogue(db));
    const known = new Set(catalogue.map((row) => row.rightCode));
    const unknown = [...wanted].filter((code) => !known.has(code));
    if (unknown.length > 0) {
      throw new HttpError(400, `Unknown right: ${unknown.slice(0, 5).join(', ')}`, { errors: { rights: 'Contains a right that does not exist.' } });
    }

    const current = await rightsRepo.listForUser(target.id, db); // Map(rightId -> granted?)
    const granted = [];
    const revoked = [];

    for (const right of catalogue) {
      const has = current.get(right.rightId); // true, false (taken away before) or undefined (never had)
      const shouldHave = wanted.has(right.rightCode);
      if (shouldHave && has !== true) {
        if (has === false) await rightsRepo.restore(target.id, right.rightId, actor.email, db);
        else await rightsRepo.grant(target.id, right.rightId, actor.email, db);
        await audit.write(
          {
            tableName: 'user_permission',
            action: has === false ? 'RESTORE' : 'ADD',
            recordKey: `${target.id}:${right.rightCode}`,
            oldValues: { right: right.rightCode, granted: false },
            newValues: { right: right.rightCode, granted: true },
            actor,
          },
          db,
        );
        granted.push(right.rightCode);
      } else if (!shouldHave && has === true) {
        await rightsRepo.revoke(target.id, right.rightId, actor.email, db);
        await audit.write(
          {
            tableName: 'user_permission',
            action: 'DELETE',
            recordKey: `${target.id}:${right.rightCode}`,
            oldValues: { right: right.rightCode, granted: true },
            newValues: { right: right.rightCode, granted: false },
            actor,
          },
          db,
        );
        revoked.push(right.rightCode);
      }
    }

    const held = new Set(catalogue.filter((row) => wanted.has(row.rightCode)).map((row) => row.rightCode));
    return {
      user: { id: target.id, firstName: target.firstName, lastName: target.lastName, role: target.role },
      modules: buildDialog(catalogue, held),
      changes: { granted, revoked },
    };
  });
}
