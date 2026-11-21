import * as productService from '../services/product.service.js';

export async function list(req, res) {
  res.json({ ok: true, ...(await productService.list(req.query)) });
}

export async function get(req, res) {
  res.json({ ok: true, product: await productService.get(req.params.prodCode) });
}

export async function create(req, res) {
  const product = await productService.create(req.user, req.body);
  res.status(201).json({ ok: true, product });
}

export async function update(req, res) {
  const product = await productService.update(req.user, req.params.prodCode, req.body);
  res.json({ ok: true, product });
}

export async function remove(req, res) {
  const product = await productService.remove(req.user, req.params.prodCode);
  res.json({ ok: true, product });
}

export async function restore(req, res) {
  const product = await productService.restore(req.user, req.params.prodCode);
  res.json({ ok: true, product });
}
