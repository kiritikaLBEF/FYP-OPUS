import './config/env.js';

import http from 'http';
import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import connectDB from './config/db.js';
import authRoutes from './routes/auth.routes.js';
import profileRoutes from './routes/profile.routes.js';
import dashboardRoutes from './routes/dashboard.routes.js';
import employerRoutes from './routes/employer.routes.js';
import adminRoutes from './routes/admin.routes.js';
import jobsRoutes from './routes/jobs.routes.js';
import workspaceRoutes from './routes/workspace.routes.js';
import notificationRoutes from './routes/notification.routes.js';
import messagingRoutes from './routes/messaging.routes.js';
import homepageRoutes from './routes/homepage.routes.js';
import walletRoutes from './routes/wallet.routes.js';
import { verifyEmailConfig, getEmailTransportMode } from './utils/email.js';
import { ensureSuperAdmin, getSuperAdminEmail } from './utils/adminConfig.js';
import { ensureDefaultBadges } from './utils/homepageBadges.js';
import { initSocketServer } from './socket/index.js';
import { paymentProviderStatus } from './utils/payments/config.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 5000;
const clientOrigin = process.env.CLIENT_URL || 'http://localhost:5173';

const googleClientId = process.env.GOOGLE_CLIENT_ID?.trim();
if (!googleClientId || googleClientId === 'your_google_client_id_here') {
  console.warn(
    '⚠ Google OAuth not configured. Set GOOGLE_CLIENT_ID in server/.env and VITE_GOOGLE_CLIENT_ID in client/.env',
  );
}

app.use(cors({ origin: clientOrigin, credentials: true }));
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    message: 'OPUS API running',
    emailConfigured: !!(process.env.SMTP_EMAIL && (process.env.GMAIL_REFRESH_TOKEN || process.env.SMTP_PASSWORD)),
    emailTransport: getEmailTransportMode(),
    googleConfigured: !!(googleClientId && googleClientId !== 'your_google_client_id_here'),
    livekitConfigured: !!(
      process.env.LIVEKIT_URL?.trim()
      && process.env.LIVEKIT_API_KEY?.trim()
      && process.env.LIVEKIT_API_SECRET?.trim()
    ),
    esewaConfigured: paymentProviderStatus().esewa.collection,
    khaltiConfigured: paymentProviderStatus().khalti.collection,
  });
});

app.use('/api/auth', authRoutes);
app.use('/api/profile', profileRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/employer', employerRoutes);
app.use('/api/jobs', jobsRoutes);
app.use('/api/workspace', workspaceRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/messaging', messagingRoutes);
app.use('/api/homepage', homepageRoutes);
app.use('/api/wallet', walletRoutes);
app.use('/api/admin', adminRoutes);

const start = async () => {
  await connectDB();
  try {
    const JobApplication = (await import('./models/JobApplication.js')).default;
    await JobApplication.syncIndexes();
  } catch (err) {
    console.warn('JobApplication index sync:', err.message);
  }
  await ensureSuperAdmin();
  await ensureDefaultBadges();
  console.log(`Super admin ready: ${getSuperAdminEmail()}`);
  await verifyEmailConfig();

  const server = http.createServer(app);
  const io = initSocketServer(server, { clientOrigin });
  app.set('io', io);

  server.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
};

start().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
