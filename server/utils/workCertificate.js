import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import User from '../models/User.js';
import ActivityEvent from '../models/ActivityEvent.js';
import { generateCertificatePdf } from './certificatePdf.js';
import { sendEmail } from './email.js';
import { notifyUser } from './notify.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const certificatesDir = path.join(__dirname, '../uploads/certificates');

const ensureCertificatesDir = () => {
  if (!fs.existsSync(certificatesDir)) fs.mkdirSync(certificatesDir, { recursive: true });
};

const hashStr = (s) => {
  let h = 0;
  for (let i = 0; i < s.length; i += 1) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  return h;
};

const makeRef = (prefix, seed) =>
  `${prefix}-${Math.abs(hashStr(seed)).toString(36).toUpperCase().slice(0, 8)}`;

const displayUserName = (user) => {
  if (!user) return 'Freelancer';
  const full = [user.firstName, user.lastName].filter(Boolean).join(' ').trim();
  return full || user.name || user.username || 'Freelancer';
};

/**
 * After payment, generate the PDF, add it to the freelancer profile, email it,
 * and notify them. Idempotent if the session is already certified.
 */
export async function issueCertificateForPaidSession(session) {
  if (!session) return session;
  if (session.status === 'certified' && session.certificateAddedToProfile) {
    return session;
  }
  if (session.status !== 'paid' && session.status !== 'certified') {
    return session;
  }

  const freelancer = await User.findById(session.freelancerId);
  if (!freelancer) return session;
  const freelancerName = displayUserName(freelancer);
  const issuedAt = session.certifiedAt || new Date();

  if (!session.certificateId) {
    session.certificateId = makeRef('OPUS-CERT', `${session._id}-cert`);
  }

  ensureCertificatesDir();
  const pdfBuffer = await generateCertificatePdf({
    certificateId: session.certificateId,
    freelancerName,
    taskTitle: session.title,
    organizationName: session.organizationName,
    issuedAt,
  });
  const safeId = String(session.certificateId).replace(/[^a-zA-Z0-9_-]/g, '_');
  const fileName = `${safeId}.pdf`;
  const absolutePath = path.join(certificatesDir, fileName);
  fs.writeFileSync(absolutePath, pdfBuffer);
  session.certificateFilePath = `/uploads/certificates/${fileName}`;
  session.status = 'certified';
  session.certifiedAt = issuedAt;

  const already = (freelancer.certifications || []).some(
    (c) => c.credentialId === session.certificateId,
  );
  if (!already) {
    freelancer.certifications.push({
      name: `Certificate of Completion: ${session.title}`,
      organization: session.organizationName,
      issueDate: issuedAt,
      credentialId: session.certificateId,
      credentialUrl: '',
      filePath: session.certificateFilePath,
    });
    await freelancer.save();
  } else {
    const cert = freelancer.certifications.find((c) => c.credentialId === session.certificateId);
    if (cert && !cert.filePath) {
      cert.filePath = session.certificateFilePath;
      await freelancer.save();
    }
  }
  session.certificateAddedToProfile = true;

  const alreadyMessaged = (session.messages || []).some(
    (m) => typeof m.text === 'string' && m.text.includes(session.certificateId),
  );
  if (!alreadyMessaged) {
    session.messages.push({
      authorId: session.employerId,
      authorRole: 'employer',
      text: `Work is complete. Certificate of Completion (${session.certificateId}) was issued after payment and emailed to ${freelancerName}.`,
    });
  }

  await session.save();

  if (freelancer.email) {
    const org = session.organizationName || 'The organization';
    const subject = `Your OPUS certificate for "${session.title}"`;
    const body =
      `Hi ${freelancerName},\n\n`
      + `Payment for "${session.title}" is complete. Your Certificate of Completion is ready.\n\n`
      + `Certificate ID: ${session.certificateId}\n\n`
      + `The PDF is attached to this email and has been added to your OPUS profile under Certifications.\n\n`
      + `You can also download it from Task Workspace.\n\n`
      + `Congratulations,\nThe OPUS team`;
    const html = `
      <div style="font-family:-apple-system,BlinkMacSystemFont,sans-serif;max-width:560px;margin:0 auto;padding:32px;color:#14161F;">
        <h2 style="margin:0 0 12px;font-size:20px;color:#0284c7;">Certificate of Completion</h2>
        <p style="margin:0 0 14px;font-size:15px;line-height:1.55;">Hi ${freelancerName},</p>
        <p style="margin:0 0 14px;font-size:15px;line-height:1.55;">
          Payment for <strong>"${session.title}"</strong> with <strong>${org}</strong> is complete.
          Your Certificate of Completion is ready.
        </p>
        <p style="margin:0 0 14px;font-size:14px;line-height:1.55;color:#475569;">
          Certificate ID: <code>${session.certificateId}</code>
        </p>
        <p style="margin:0 0 14px;font-size:15px;line-height:1.55;">
          The PDF is attached to this email and has been added to your OPUS profile under Certifications.
          You can also download it from Task Workspace.
        </p>
        <p style="margin:24px 0 0;font-size:13px;color:#6B7280;">Congratulations,<br/>The OPUS team</p>
      </div>
    `;
    try {
      await sendEmail(freelancer.email, subject, body, {
        fromName: 'OPUS Certificates',
        html,
        attachments: [
          {
            filename: `OPUS-Certificate-${safeId}.pdf`,
            content: pdfBuffer,
            contentType: 'application/pdf',
          },
        ],
      });
    } catch (emailErr) {
      console.error('Certificate email failed:', emailErr.message);
    }
  }

  await ActivityEvent.create({
    userId: session.freelancerId,
    type: 'certificate_added',
    title: 'Certificate added',
    subtitle: `Certificate of Completion for "${session.title}" is on your profile`,
    meta: {
      organizationName: session.organizationName,
      projectTitle: session.title,
      projectRef: session.paymentRef || '',
    },
    occurredAt: new Date(),
    isDemo: false,
  }).catch(() => {});

  await notifyUser({
    userId: session.freelancerId,
    type: 'certificate_issued',
    title: 'Certificate issued',
    message: `Your certificate for "${session.title}" is ready. It is on your profile and in Task Workspace.`,
    link: `/dashboard/workspace/${session._id}`,
    meta: { workspaceId: session._id, jobId: session.jobPostingId },
  });

  return session;
}
