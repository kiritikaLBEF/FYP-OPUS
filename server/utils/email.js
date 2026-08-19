import nodemailer from 'nodemailer';
import { OAuth2Client } from 'google-auth-library';

const GMAIL_SEND_SCOPE = 'https://mail.google.com/';

let transporter = null;
let oauth2Client = null;

const getSenderEmail = () => (process.env.SMTP_EMAIL || 'verifymyopus@gmail.com').trim();

const getSmtpPassword = () => process.env.SMTP_PASSWORD?.replace(/\s/g, '').trim();

const canUseGmailOAuth = () => {
  const clientId = process.env.GOOGLE_CLIENT_ID?.trim();
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET?.trim();
  const refreshToken = process.env.GMAIL_REFRESH_TOKEN?.trim();
  return !!(clientId && clientSecret && refreshToken);
};

const getOAuth2Client = () => {
  if (!oauth2Client) {
    oauth2Client = new OAuth2Client(
      process.env.GOOGLE_CLIENT_ID?.trim(),
      process.env.GOOGLE_CLIENT_SECRET?.trim(),
      process.env.GOOGLE_OAUTH_REDIRECT_URI?.trim() || 'https://developers.google.com/oauthplayground',
    );
    oauth2Client.setCredentials({
      refresh_token: process.env.GMAIL_REFRESH_TOKEN?.trim(),
    });
  }
  return oauth2Client;
};

export const resetTransporter = () => {
  transporter = null;
  oauth2Client = null;
};

const createOAuthTransporter = () => {
  const user = getSenderEmail();
  const client = getOAuth2Client();
  return nodemailer.createTransport({
    service: 'gmail',
    auth: {
      type: 'OAuth2',
      user,
      clientId: process.env.GOOGLE_CLIENT_ID?.trim(),
      clientSecret: process.env.GOOGLE_CLIENT_SECRET?.trim(),
      refreshToken: process.env.GMAIL_REFRESH_TOKEN?.trim(),
      async accessToken() {
        const { token } = await client.getAccessToken();
        if (!token) throw new Error('Failed to obtain Gmail OAuth access token');
        return token;
      },
    },
  });
};

const createSmtpTransporter = () => {
  const user = getSenderEmail();
  const pass = getSmtpPassword();
  if (!user || !pass) {
    throw new Error('Email is not configured. Set Gmail OAuth (GMAIL_REFRESH_TOKEN + GOOGLE_CLIENT_SECRET) or SMTP_PASSWORD in server/.env');
  }
  return nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 465,
    secure: true,
    auth: { user, pass },
  });
};

const getTransporter = () => {
  if (!transporter) {
    transporter = canUseGmailOAuth() ? createOAuthTransporter() : createSmtpTransporter();
  }
  return transporter;
};

const wrapHtml = (body, title = 'OPUS') => `
  <div style="font-family:-apple-system,BlinkMacSystemFont,sans-serif;max-width:520px;margin:0 auto;padding:32px;color:#14161F;">
    <p style="margin:0 0 16px;font-size:15px;line-height:1.55;white-space:pre-wrap;">${body}</p>
    <p style="color:#9CA3AF;font-size:12px;margin:24px 0 0;">- ${title}</p>
  </div>
`;

/**
 * Shared email sender used by OTP verification and admin notes.
 * Sends from verifymyopus@gmail.com via Gmail OAuth (preferred) or SMTP app password.
 */
export const sendEmail = async (to, subject, body, options = {}) => {
  const fromUser = getSenderEmail();
  const fromName = options.fromName || 'OPUS';
  const text = String(body || '').trim();
  const html = options.html || wrapHtml(text, fromName);

  try {
    await getTransporter().sendMail({
      from: `"${fromName}" <${fromUser}>`,
      to,
      subject,
      text,
      html,
      attachments: options.attachments || [],
    });
  } catch (err) {
    const raw = String(err?.message || '');
    const lower = raw.toLowerCase();

    if (lower.includes('535') || lower.includes('badcredentials') || lower.includes('username and password not accepted')) {
      throw new Error(
        'Email auth failed (Gmail rejected credentials). Update server/.env with valid Gmail OAuth ' +
        '(GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GMAIL_REFRESH_TOKEN) or a valid SMTP app password.',
      );
    }

    throw err;
  }
};

export const sendOtpEmail = async (to, otp, firstName) => {
  const html = `
    <div style="font-family:-apple-system,BlinkMacSystemFont,sans-serif;max-width:480px;margin:0 auto;padding:32px;">
      <h2 style="color:#7C5CFF;margin:0 0 8px;">Verify your OPUS account</h2>
      <p style="color:#6B7280;">Hi ${firstName}, use this code to complete your registration:</p>
      <div style="background:#F8F9FC;border-radius:12px;padding:24px;text-align:center;margin:24px 0;">
        <span style="font-size:32px;font-weight:600;letter-spacing:8px;color:#14161F;">${otp}</span>
      </div>
      <p style="color:#9CA3AF;font-size:13px;">This code expires in 10 minutes. If you didn't request this, ignore this email.</p>
    </div>
  `;
  await sendEmail(to, 'Your OPUS verification code', `Hi ${firstName}, your verification code is ${otp}. It expires in 10 minutes.`, {
    fromName: 'OPUS Verification',
    html,
  });
};

export const sendPasswordResetOtpEmail = async (to, otp, firstName) => {
  const name = firstName || 'there';
  const html = `
    <div style="font-family:-apple-system,BlinkMacSystemFont,sans-serif;max-width:480px;margin:0 auto;padding:32px;">
      <h2 style="color:#0071e3;margin:0 0 8px;">Reset your OPUS password</h2>
      <p style="color:#6B7280;">Hi ${name}, use this code to reset your password:</p>
      <div style="background:#F8F9FC;border-radius:12px;padding:24px;text-align:center;margin:24px 0;">
        <span style="font-size:32px;font-weight:600;letter-spacing:8px;color:#14161F;">${otp}</span>
      </div>
      <p style="color:#9CA3AF;font-size:13px;">This code expires in 10 minutes. If you didn't request a password reset, ignore this email.</p>
    </div>
  `;
  await sendEmail(
    to,
    'Your OPUS password reset code',
    `Hi ${name}, your password reset code is ${otp}. It expires in 10 minutes.`,
    { fromName: 'OPUS Security', html },
  );
};

/** @deprecated Use sendEmail. kept for existing call sites */
export const sendSystemEmail = async ({ to, subject, html, text }) => {
  await sendEmail(to, subject, text || '', { fromName: 'OPUS Admin', html });
};

export const verifyEmailConfig = async () => {
  try {
    resetTransporter();
    const user = getSenderEmail();
    if (canUseGmailOAuth()) {
      const client = getOAuth2Client();
      const { token } = await client.getAccessToken();
      if (!token) throw new Error('Gmail OAuth refresh token did not return an access token');
      console.log(`Email service ready via Gmail OAuth (${user})`);
      return true;
    }
    if (!getSmtpPassword()) {
      console.warn('Email not configured. set GMAIL_REFRESH_TOKEN + GOOGLE_CLIENT_SECRET for OAuth, or SMTP_PASSWORD');
      return false;
    }
    await getTransporter().verify();
    console.log(`Email service ready via SMTP (${user})`);
    return true;
  } catch (err) {
    console.warn('Email service error:', err.message);
    resetTransporter();
    return false;
  }
};

export const getEmailTransportMode = () => (canUseGmailOAuth() ? 'gmail_oauth' : 'smtp');
