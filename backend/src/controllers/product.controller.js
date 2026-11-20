import * as productService from '../services/product.service.js';

export async function list(req, res) {
  res.json({ ok: true, ...(await productService.list(req.query)) });
}
