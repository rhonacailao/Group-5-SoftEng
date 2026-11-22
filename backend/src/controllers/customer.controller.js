import * as customerService from '../services/customer.service.js';

export async function list(req, res) {
  res.json({ ok: true, ...(await customerService.list(req.query)) });
}

export async function get(req, res) {
  res.json({ ok: true, customer: await customerService.get(req.params.custNo) });
}

export async function nextNumber(req, res) {
  res.json({ ok: true, ...(await customerService.previewNumber()) });
}

export async function create(req, res) {
  const customer = await customerService.create(req.user, req.body);
  res.status(201).json({ ok: true, customer });
}

export async function update(req, res) {
  const customer = await customerService.update(req.user, req.params.custNo, req.body);
  res.json({ ok: true, customer });
}

export async function remove(req, res) {
  const customer = await customerService.remove(req.user, req.params.custNo);
  res.json({ ok: true, customer });
}

export async function restore(req, res) {
  const customer = await customerService.restore(req.user, req.params.custNo);
  res.json({ ok: true, customer });
}
