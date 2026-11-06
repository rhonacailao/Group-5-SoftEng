import nodemailer from 'nodemailer';

// Real email when SMTP_HOST is set in .env. Otherwise (normal on a dev laptop) the email
// is printed in the terminal instead, so you can copy the link out of it.
function createDefaultTransport() {
  if (!process.env.SMTP_HOST) {
    return async (message) => {
      console.log('\n--- Email (SMTP not configured, printed instead of sent) ---');
      console.log(`To: ${message.to}\nSubject: ${message.subject}\n\n${message.text}`);
      console.log('------------------------------------------------------------\n');
    };
  }

  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT) || 587,
    secure: Number(process.env.SMTP_PORT) === 465, // 465 = encrypted from the start
    auth: process.env.SMTP_USER
      ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
      : undefined,
  });
  const from = process.env.MAIL_FROM || process.env.SMTP_USER;
  return (message) => transporter.sendMail({ from, ...message });
}

let transport = null;

// The tests replace the transport so they can read the emails without sending any
export function setMailTransport(fn) {
  transport = fn;
}

export async function sendMail(message) {
  if (!transport) transport = createDefaultTransport();
  await transport(message);
}
