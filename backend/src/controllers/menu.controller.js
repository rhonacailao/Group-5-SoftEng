import * as menuService from '../services/menu.service.js';

export async function getMenu(req, res) {
  res.json({ ok: true, ...(await menuService.getMenu(req.user)) });
}
