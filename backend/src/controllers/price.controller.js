import * as priceService from '../services/price.service.js';

export async function list(req, res) {
  res.json({ ok: true, ...(await priceService.list(req.params.prodCode)) });
}

export async function create(req, res) {
  const price = await priceService.create(req.user, req.params.prodCode, req.body);
  res.status(201).json({ ok: true, price });
}

export async function update(req, res) {
  const price = await priceService.update(req.user, req.params.prodCode, req.params.effDate, req.body);
  res.json({ ok: true, price });
}

export async function remove(req, res) {
  const price = await priceService.remove(req.user, req.params.prodCode, req.params.effDate);
  res.json({ ok: true, price });
}
