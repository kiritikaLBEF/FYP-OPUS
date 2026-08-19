const wrapText = (ctx, text, maxWidth) => {
  const words = String(text || '').split(/\s+/).filter(Boolean);
  const lines = [];
  let current = '';
  words.forEach((word) => {
    const next = current ? `${current} ${word}` : word;
    if (ctx.measureText(next).width <= maxWidth) {
      current = next;
    } else {
      if (current) lines.push(current);
      current = word;
    }
  });
  if (current) lines.push(current);
  return lines.slice(0, 5);
};

export function downloadBadgeCertificate(badge, recipientName) {
  const name = String(recipientName || 'Freelancer').trim() || 'Freelancer';
  const label = badge?.label || 'OPUS Badge';
  const reason = (badge?.description || 'recognized performance on OPUS').replace(/\.$/, '');
  const color = badge?.color || '#0071e3';
  const issued = new Date().toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  const canvas = document.createElement('canvas');
  canvas.width = 1200;
  canvas.height = 675;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  ctx.fillStyle = '#f7f4ee';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.strokeStyle = '#1d1d1f';
  ctx.lineWidth = 3;
  ctx.strokeRect(36, 36, canvas.width - 72, canvas.height - 72);
  ctx.lineWidth = 1;
  ctx.strokeStyle = '#c9a227';
  ctx.strokeRect(48, 48, canvas.width - 96, canvas.height - 96);

  ctx.fillStyle = '#0071e3';
  ctx.font = '600 18px -apple-system, BlinkMacSystemFont, Helvetica, Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('OPUS', canvas.width / 2, 100);

  ctx.fillStyle = '#86868b';
  ctx.font = '500 13px -apple-system, BlinkMacSystemFont, Helvetica, Arial, sans-serif';
  ctx.fillText('STUDENT FREELANCE PLATFORM', canvas.width / 2, 124);

  ctx.beginPath();
  ctx.arc(canvas.width / 2, 210, 42, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.fill();
  ctx.strokeStyle = '#d6b25e';
  ctx.lineWidth = 6;
  ctx.stroke();

  ctx.fillStyle = '#1d1d1f';
  ctx.font = '600 36px -apple-system, BlinkMacSystemFont, Helvetica, Arial, sans-serif';
  ctx.fillText(label, canvas.width / 2, 290);

  const body = `${name} has been given this badge for ${reason}.`;
  ctx.fillStyle = '#3d3d3f';
  ctx.font = '400 22px -apple-system, BlinkMacSystemFont, Helvetica, Arial, sans-serif';
  const lines = wrapText(ctx, body, 860);
  lines.forEach((line, i) => {
    ctx.fillText(line, canvas.width / 2, 350 + i * 32);
  });

  ctx.fillStyle = '#1d1d1f';
  ctx.font = '600 18px -apple-system, BlinkMacSystemFont, Helvetica, Arial, sans-serif';
  ctx.fillText('OPUS Team', canvas.width / 2, 540);

  ctx.fillStyle = '#86868b';
  ctx.font = '400 14px -apple-system, BlinkMacSystemFont, Helvetica, Arial, sans-serif';
  ctx.fillText(issued, canvas.width / 2, 568);

  canvas.toBlob((blob) => {
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const slug = label.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    a.href = url;
    a.download = `OPUS-${slug || 'badge'}-certificate.png`;
    a.click();
    URL.revokeObjectURL(url);
  }, 'image/png');
}
