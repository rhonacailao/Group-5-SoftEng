// Creates (or re-invites) a superadmin and sends them a one-time "set your password" link.
// No password is ever typed, stored in the repo, or put on the command line.
//
//   npm run create-superadmin -- someone@example.com "First" "Last"
//
// Needs DATABASE_URL in backend/.env. Without SMTP settings the email is printed here.
import 'dotenv/config';
import { pool, withTransaction } from '../src/config/db.js';
import * as users from '../src/repositories/user.repository.js';
import * as audit from '../src/repositories/audit.repository.js';
import * as credentials from '../src/services/credential.service.js';
import { checkName, checkEmail } from '../src/utils/validators.js';

const [, , rawEmail, rawFirst, rawLast] = process.argv;
const email = checkEmail(rawEmail);
const first = checkName(rawFirst, 'First name');
const last = checkName(rawLast, 'Last name');

if (email.error || first.error || last.error) {
  console.error('Usage: npm run create-superadmin -- <email> "<First name>" "<Last name>"');
  console.error(email.error || first.error || last.error);
  process.exit(1);
}

try {
  const result = await withTransaction('create-superadmin', async (db) => {
    const existing = await users.findByEmail(email.value, db);
    if (existing && existing.hasPassword) {
      throw new Error('That user already has a password. Use "Forgot password" on the login page.');
    }

    let user = existing;
    if (!user) {
      user = await users.insert(
        { firstName: first.value, lastName: last.value, email: email.value, role: 'superadmin', status: 'Pending', createdBy: 'create-superadmin' },
        db,
      );
      await audit.write(
        { tableName: 'app_user', action: 'ADD', recordKey: user.id, newValues: { email: user.email, role: 'superadmin' }, actor: { email: 'create-superadmin' } },
        db,
      );
    } else if (user.role !== 'superadmin') {
      throw new Error(`${user.email} already exists as a ${user.role}. Promote them in the app instead.`);
    }

    const token = await credentials.createLink(db, user, 'set_password');
    return { user, token };
  });

  const sent = await credentials.emailLink(result.user, 'set_password', result.token);
  console.log(sent ? `Link sent to ${result.user.email}.` : 'Could not send the email (see the error above).');
} catch (err) {
  console.error(err.message);
  process.exitCode = 1;
} finally {
  await pool.end();
}
