/**
 * One-time setup: obtain GMAIL_REFRESH_TOKEN for verifymyopus@gmail.com
 *
 * 1. Google Cloud Console → APIs & Services → enable Gmail API
 * 2. OAuth consent screen → add scope https://mail.google.com/
 * 3. Credentials → OAuth client (Web) → add redirect https://developers.google.com/oauthplayground
 * 4. Run: node scripts/gmail-oauth-setup.js
 * 5. Paste auth code → copy refresh token into server/.env as GMAIL_REFRESH_TOKEN
 */
import '../config/env.js';
import readline from 'readline';
import { OAuth2Client } from 'google-auth-library';

const clientId = process.env.GOOGLE_CLIENT_ID?.trim();
const clientSecret = process.env.GOOGLE_CLIENT_SECRET?.trim();
const redirectUri = process.env.GOOGLE_OAUTH_REDIRECT_URI?.trim() || 'https://developers.google.com/oauthplayground';

if (!clientId || !clientSecret) {
  console.error('Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in server/.env first');
  process.exit(1);
}

const oauth2 = new OAuth2Client(clientId, clientSecret, redirectUri);
const authUrl = oauth2.generateAuthUrl({
  access_type: 'offline',
  prompt: 'consent',
  scope: ['https://mail.google.com/'],
});

console.log('\nOpen this URL and authorize verifymyopus@gmail.com:\n');
console.log(authUrl);
console.log('\n');

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
rl.question('Paste authorization code here: ', async (code) => {
  rl.close();
  try {
    const { tokens } = await oauth2.getToken(code.trim());
    console.log('\nAdd to server/.env:\n');
    console.log(`GMAIL_REFRESH_TOKEN=${tokens.refresh_token}`);
    if (!tokens.refresh_token) {
      console.warn('\nNo refresh_token returned. Revoke app access and re-run with prompt=consent');
    }
  } catch (err) {
    console.error('Token exchange failed:', err.message);
    process.exit(1);
  }
});
