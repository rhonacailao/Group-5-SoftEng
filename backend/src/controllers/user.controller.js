import * as userService from '../services/user.service.js';
import { parseId } from '../utils/validators.js';

export async function list(req, res) {
  res.json({ ok: true, ...(await userService.list(req.user, req.query)) });
}

export async function get(req, res) {
  res.json({ ok: true, user: await userService.get(req.user, parseId(req.params.id)) });
}

export async function create(req, res) {
  const result = await userService.create(req.user, req.body ?? {});
  res.status(201).json({ ok: true, ...result });
}

export async function update(req, res) {
  const user = await userService.update(req.user, parseId(req.params.id), req.body ?? {});
  res.json({ ok: true, user });
}

export async function block(req, res) {
  res.json({ ok: true, user: await userService.setBlocked(req.user, parseId(req.params.id), true) });
}

export async function unblock(req, res) {
  res.json({ ok: true, user: await userService.setBlocked(req.user, parseId(req.params.id), false) });
}

export async function resendInvite(req, res) {
  res.json({ ok: true, ...(await userService.resendInvite(req.user, parseId(req.params.id))) });
}
