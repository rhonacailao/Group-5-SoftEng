import * as rightsRepo from '../repositories/rights.repository.js';
import { inDisplayOrder } from '../utils/rightsOrder.js';

// Where each module lives in the website (frontend/src/App.tsx) and which Font Awesome icon
// the sidebar and tile use. A module not listed here still works with a generated path.
const MODULE_PAGES = {
  CUSTOMER: { path: '/customers', icon: 'fa-users' },
  PRODUCT: { path: '/products', icon: 'fa-box' },
  HUMAN_RESOURCES: { path: '/human-resources', icon: 'fa-id-badge' },
  SALES: { path: '/sales', icon: 'fa-cart-shopping' },
  REPORTS: { path: '/reports', icon: 'fa-chart-line' },
};

function pageFor(moduleCode) {
  return MODULE_PAGES[moduleCode] ?? { path: `/${moduleCode.toLowerCase().replace(/_/g, '-')}`, icon: 'fa-folder' };
}

// S1-DEV-08: what the main page shows for the logged-in user.
//   tiles   = the modules they may open (at least one right in it), with the rights they hold
//   sidebar = Dashboard, those same modules, and User Management for admins and superadmins
// A superadmin holds every right; everyone else holds what the Rights dialog gave them.
export async function getMenu(user) {
  const catalogue = inDisplayOrder(await rightsRepo.listCatalogue());
  const held = user.role === 'superadmin'
    ? new Set(catalogue.map((row) => row.rightCode))
    : new Set(await rightsRepo.listGrantedCodes(user.id));

  // Group the catalogue by module (modules keep their seeded order)
  const modules = new Map();
  for (const row of catalogue) {
    if (!modules.has(row.moduleCode)) {
      modules.set(row.moduleCode, { code: row.moduleCode, name: row.moduleName, total: 0, rights: [] });
    }
    const module = modules.get(row.moduleCode);
    module.total += 1;
    if (held.has(row.rightCode)) module.rights.push(row.rightCode);
  }

  const tiles = [...modules.values()]
    .filter((module) => module.rights.length > 0)
    .map((module) => ({
      code: module.code,
      name: module.name,
      ...pageFor(module.code), // path + icon
      rights: module.rights,          // lets the page show or hide Add / Edit / Delete buttons
      grantedCount: module.rights.length,
      total: module.total,
    }));

  const sidebar = [{ key: 'DASHBOARD', label: 'Dashboard', path: '/dashboard', icon: 'fa-gauge-high' }];
  for (const tile of tiles) sidebar.push({ key: tile.code, label: tile.name, path: tile.path, icon: tile.icon });
  if (user.role === 'admin' || user.role === 'superadmin') {
    sidebar.push({ key: 'USER_MANAGEMENT', label: 'User Management', path: '/user-management', icon: 'fa-user-shield' });
  }

  return {
    user: { id: user.id, firstName: user.firstName, lastName: user.lastName, email: user.email, role: user.role },
    sidebar,
    tiles,
    hasModuleAccess: tiles.length > 0, // false -> the page can say "no modules assigned yet"
  };
}
