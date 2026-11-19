import * as customerService from '../services/customer.service.js';

export async function list(req, res) {
  res.json({ ok: true, ...(await customerService.list(req.query)) });
}
