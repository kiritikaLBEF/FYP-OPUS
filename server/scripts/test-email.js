import '../config/env.js';
import { verifyEmailConfig, sendEmail, getEmailTransportMode } from '../utils/email.js';

const ok = await verifyEmailConfig();
console.log('verify:', ok);
console.log('transport:', getEmailTransportMode());
console.log('SMTP_EMAIL:', process.env.SMTP_EMAIL);

const to = process.argv[2] || 'kcsagar153@gmail.com';

try {
  await sendEmail(to, 'OPUS admin note test', 'This is a test note from the shared sendEmail utility.');
  console.log('SENT OK to', to);
} catch (e) {
  console.error('SEND FAILED:', e.message);
  process.exit(1);
}
