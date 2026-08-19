import PDFDocument from 'pdfkit';

const fmtDate = (d) =>
  new Date(d || Date.now()).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

/**
 * Build a Certificate of Completion PDF buffer.
 */
export const generateCertificatePdf = ({
  certificateId,
  freelancerName,
  taskTitle,
  organizationName,
  issuedAt,
}) =>
  new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: 'A4',
      layout: 'landscape',
      margin: 48,
    });
    const chunks = [];
    doc.on('data', (c) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const pageW = doc.page.width;
    const pageH = doc.page.height;

    doc.rect(0, 0, pageW, pageH).fill('#f8fafc');
    doc.rect(28, 28, pageW - 56, pageH - 56).lineWidth(2).strokeColor('#0ea5e9').stroke();
    doc.rect(36, 36, pageW - 72, pageH - 72).lineWidth(0.75).strokeColor('#94a3b8').stroke();

    doc.fillColor('#0284c7').fontSize(14).text('OPUS · Freelance Marketplace', 0, 70, {
      align: 'center',
      width: pageW,
    });

    doc.fillColor('#0f172a').fontSize(32).text('Certificate of Completion', 0, 110, {
      align: 'center',
      width: pageW,
    });

    doc.fillColor('#475569').fontSize(13).text(
      'This certifies that the freelancer has successfully completed',
      80,
      170,
      { align: 'center', width: pageW - 160 },
    );

    doc.fillColor('#0f172a').fontSize(22).text(`"${taskTitle || 'Project'}"`, 80, 210, {
      align: 'center',
      width: pageW - 160,
    });

    doc.fillColor('#334155').fontSize(14).text(
      `Awarded to ${freelancerName || 'Freelancer'}`,
      80,
      260,
      { align: 'center', width: pageW - 160 },
    );

    doc.fillColor('#475569').fontSize(13).text(
      `Commissioned by ${organizationName || 'Organization'}`,
      80,
      290,
      { align: 'center', width: pageW - 160 },
    );

    doc.moveTo(pageW / 2 - 80, 340).lineTo(pageW / 2 + 80, 340).strokeColor('#cbd5e1').stroke();

    const leftX = 120;
    const rightX = pageW / 2 + 40;
    const footY = 370;

    doc.fillColor('#64748b').fontSize(10).text('Issued', leftX, footY);
    doc.fillColor('#0f172a').fontSize(12).text(fmtDate(issuedAt), leftX, footY + 16);

    doc.fillColor('#64748b').fontSize(10).text('Certificate ID', rightX, footY);
    doc.fillColor('#0f172a').fontSize(12).text(certificateId || '-', rightX, footY + 16, {
      width: pageW - rightX - 80,
    });

    doc.fillColor('#94a3b8').fontSize(9).text(
      'This certificate was issued through the OPUS freelancing platform.',
      80,
      pageH - 70,
      { align: 'center', width: pageW - 160 },
    );

    doc.end();
  });
