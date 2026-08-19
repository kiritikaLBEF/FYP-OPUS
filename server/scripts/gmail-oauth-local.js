/**
 * Local Gmail OAuth setup (avoids OAuth Playground redirect issues).
 *
 * 1. Google Cloud Console → APIs & Services → Credentials → your OAuth Web client
 * 2. Authorized redirect URIs → add exactly:
 *    http://localhost:8765/oauth/callback
 * 3. Enable Gmail API for the project
 * 4. Run: node scripts/gmail-oauth-local.js
 * 5. Sign in as kritika.chauhan200201@gmail.com when browser opens
 * 6. Copy GMAIL_REFRESH_TOKEN into server/.env and restart server
 */
import '../config/env.js';
import http from 'http';
import { OAuth2Client } from 'google-auth-library';

const PORT = 8765;
const REDIRECT_URI = `http://localhost:${PORT}/oauth/callback`;

const clientId = process.env.GOOGLE_CLIENT_ID?.trim();
const clientSecret = process.env.GOOGLE_CLIENT_SECRET?.trim();

if (!clientId || !clientSecret) {
  console.error('Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in server/.env first');
  process.exit(1);
}

const oauth2 = new OAuth2Client(clientId, clientSecret, REDIRECT_URI);
const authUrl = oauth2.generateAuthUrl({
  access_type: 'offline',
  prompt: 'consent',
  scope: ['https://mail.google.com/'],
});

const htmlOk = (token) => `<!DOCTYPE html><html><body style="font-family:sans-serif;padding:40px">
<h2>Gmail OAuth success</h2>
<p>Add this to <code>server/.env</code>, restart the backend, then close this tab.</p>
<pre style="background:#f4f4f4;padding:16px;overflow:auto">GMAIL_REFRESH_TOKEN=${token}</pre>
</body></html>`;

const htmlErr = (msg) => `<!DOCTYPE html><html><body style="font-family:sans-serif;padding:40px;color:#b91c1c">
<h2>Gmail OAuth failed</h2><p>${msg}</p><p>Close this tab and run the script again.</p></body></html>`;

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  if (url.pathname !== '/oauth/callback') {
    res.writeHead(404);
    res.end('Not found');
    return;
  }

  const code = url.searchParams.get('code');
  const err = url.searchParams.get('error');
  if (err || !code) {
    res.writeHead(400, { 'Content-Type': 'text/html' });
    res.end(htmlErr(err || 'No authorization code received'));
    server.close();
    process.exit(1);
  }

  try {
    const { tokens } = await oauth2.getToken(code);
    if (!tokens.refresh_token) {
      res.writeHead(400, { 'Content-Type': 'text/html' });
      res.end(htmlErr('No refresh token returned. Revoke app access at myaccount.google.com/permissions and run again.'));
      server.close();
      process.exit(1);
    }
    console.log('\nAdd to server/.env:\n');
    console.log(`GMAIL_REFRESH_TOKEN=${tokens.refresh_token}\n`);
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(htmlOk(tokens.refresh_token));
  } catch (e) {
    res.writeHead(500, { 'Content-Type': 'text/html' });
    res.end(htmlErr(e.message || 'Token exchange failed'));
    server.close();
    process.exit(1);
  } finally {
    setTimeout(() => {
      server.close();
      process.exit(0);
    }, 500);
  }
});

server.listen(PORT, () => {
  console.log('\n--- Gmail OAuth (local) ---\n');
  console.log('1) In Google Cloud Console, add this Authorized redirect URI to your Web OAuth client:');
  console.log(`   ${REDIRECT_URI}\n`);
  console.log('2) Open this URL and sign in as kritika.chauhan200201@gmail.com:\n');
  console.log(authUrl);
  console.log('\nWaiting for callback on port', PORT, '...\n');
});
