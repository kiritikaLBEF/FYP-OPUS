import PDFDocument from 'pdfkit';

const fmtMoney = (n) => `NPR ${Number(n).toLocaleString('en-NP', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const fmtDate = (d) => new Date(d).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });

export const generateEStatementPdf = (data) => new Promise((resolve, reject) => {
  const doc = new PDFDocument({ margin: 50, size: 'A4' });
  const chunks = [];
  doc.on('data', (c) => chunks.push(c));
  doc.on('end', () => resolve(Buffer.concat(chunks)));
  doc.on('error', reject);

  const { user, period, summary, transactions, freelancerId, accountType, accountHolder, referenceLabel } = data;
  const pageWidth = doc.page.width - 100;
  const isEmployer = accountType === 'employer';
  const subtitle = isEmployer ? 'Organization Financial Services' : 'Freelancer Financial Services';
  const holder = accountHolder || `${user.firstName} ${user.lastName}`;
  const refLabel = referenceLabel || (isEmployer ? 'Organization Reference' : 'Freelancer Reference');

  // Header
  doc.fontSize(22).fillColor('#0071e3').text('OPUS', 50, 45);
  doc.fontSize(9).fillColor('#666').text(subtitle, 50, 70);
  doc.fontSize(16).fillColor('#111').text('Account E-Statement', 50, 95, { align: 'left' });
  doc.fontSize(9).fillColor('#666').text(`Generated: ${fmtDate(new Date())}`, 50, 118);

  doc.moveTo(50, 135).lineTo(50 + pageWidth, 135).strokeColor('#e5e5ea').stroke();

  // Account info
  let y = 150;
  const info = [
    ['Account Holder', holder],
    ['Email', user.email],
    [refLabel, freelancerId],
    ['Statement Period', period.label],
  ];
  info.forEach(([label, val]) => {
    doc.fontSize(8).fillColor('#888').text(label, 50, y);
    doc.fontSize(10).fillColor('#111').text(val, 180, y - 1);
    y += 20;
  });

  y += 10;
  doc.roundedRect(50, y, pageWidth, 72, 6).fillAndStroke('#f5f5f7', '#e5e5ea');
  const sumY = y + 14;
  const cols = [
    ['Opening Balance', fmtMoney(summary.openingBalance)],
    ['Total Credits', fmtMoney(summary.totalCredits)],
    ['Total Debits', fmtMoney(summary.totalDebits)],
    ['Closing Balance', fmtMoney(summary.closingBalance)],
  ];
  cols.forEach(([label, val], i) => {
    const x = 60 + (i % 2) * (pageWidth / 2);
    const row = Math.floor(i / 2);
    doc.fontSize(7).fillColor('#888').text(label, x, sumY + row * 28);
    doc.fontSize(11).fillColor('#0071e3').text(val, x, sumY + 10 + row * 28);
  });
  doc.fontSize(9).fillColor('#111').text(`Available Balance: ${fmtMoney(summary.availableBalance)}`, 50, y + 82);

  y += 110;

  // Table header
  const headers = ['Date & Time', 'Txn ID', 'Description', 'Org Ref', 'Proj Ref', 'Dr.', 'Cr.', 'Balance'];
  const colWidths = [72, 68, 130, 52, 52, 48, 48, 52];
  let x = 50;
  doc.rect(50, y, pageWidth, 18).fill('#0071e3');
  doc.fontSize(6.5).fillColor('#fff');
  headers.forEach((h, i) => {
    doc.text(h, x + 3, y + 5, { width: colWidths[i] - 4 });
    x += colWidths[i];
  });
  y += 18;

  transactions.forEach((t, idx) => {
    if (y > 720) {
      doc.addPage();
      y = 50;
    }
    if (idx % 2 === 0) doc.rect(50, y, pageWidth, 32).fill('#fafafa');
    x = 50;
    doc.fontSize(5.5).fillColor('#333');
    const row = [
      fmtDate(t.occurredAt),
      t.transactionId,
      t.description.slice(0, 80),
      t.organizationRef || '-',
      t.projectRef || '-',
      t.debit ? fmtMoney(t.debit) : '-',
      t.credit ? fmtMoney(t.credit) : '-',
      fmtMoney(t.runningBalance),
    ];
    row.forEach((cell, i) => {
      doc.text(String(cell), x + 2, y + 4, { width: colWidths[i] - 4, lineGap: 0 });
      x += colWidths[i];
    });
    y += 32;
  });

  const pages = doc.bufferedPageRange();
  for (let i = 0; i < pages.count; i++) {
    doc.switchToPage(i);
    doc.fontSize(7).fillColor('#999')
      .text(`OPUS E-Statement · ${freelancerId} · Page ${i + 1} of ${pages.count}`, 50, doc.page.height - 40, { align: 'center', width: pageWidth });
  }

  doc.end();
});
