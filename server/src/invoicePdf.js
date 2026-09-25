import PDFDocument from 'pdfkit';

function zar(n) {
  return `R ${Number(n || 0).toLocaleString('en-ZA', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function formatDate(value) {
  if (!value) return '—';
  const d = typeof value === 'string' && /^\d{4}-\d{2}-\d{2}/.test(value)
    ? new Date(`${value.slice(0, 10)}T12:00:00`)
    : new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleDateString('en-ZA', {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

/** Build a PrintShop Pro tax invoice PDF as a Buffer. */
export function buildInvoicePdf({ invoice, items }) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: 'A4',
      margin: 50,
      info: {
        Title: `Invoice ${invoice.invoice_number}`,
        Author: 'PrintShop Pro',
        Subject: invoice.description || 'Tax Invoice',
      },
    });
    const chunks = [];
    doc.on('data', (c) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const pageWidth = doc.page.width;
    const left = 50;
    const right = pageWidth - 50;
    const contentWidth = right - left;

    doc.rect(0, 0, pageWidth, 90).fill('#0f0f0d');
    doc.fillColor('#00d4aa').fontSize(22).font('Helvetica-Bold')
      .text('PrintShop Pro', left, 28, { width: contentWidth / 2 });
    doc.fillColor('#ffffff').fontSize(11).font('Helvetica')
      .text('Tax Invoice', left, 56);
    doc.fillColor('#00d4aa').fontSize(16).font('Helvetica-Bold')
      .text(invoice.invoice_number, left + contentWidth / 2, 36, {
        width: contentWidth / 2,
        align: 'right',
      });

    let y = 118;

    doc.fillColor('#111111').fontSize(10).font('Helvetica').text('Bill to', left, y);
    doc.font('Helvetica-Bold').fontSize(13).text(invoice.customer_name || '—', left, y + 14);
    if (invoice.customer_email) {
      doc.font('Helvetica').fontSize(10).fillColor('#444444')
        .text(invoice.customer_email, left, y + 32);
    }
    if (invoice.customer_phone) {
      doc.font('Helvetica').fontSize(10).fillColor('#444444')
        .text(invoice.customer_phone, left, y + 46);
    }

    doc.fillColor('#111111').fontSize(10).font('Helvetica')
      .text('Issue date', left + contentWidth / 2, y, { width: contentWidth / 2, align: 'right' });
    doc.font('Helvetica-Bold').fontSize(11)
      .text(formatDate(invoice.issue_date), left + contentWidth / 2, y + 14, {
        width: contentWidth / 2,
        align: 'right',
      });
    doc.font('Helvetica').fontSize(10).fillColor('#444444')
      .text(`Due: ${formatDate(invoice.due_date)}`, left + contentWidth / 2, y + 32, {
        width: contentWidth / 2,
        align: 'right',
      });
    doc.text(`Balance due: ${zar(invoice.balance ?? invoice.total)}`, left + contentWidth / 2, y + 46, {
      width: contentWidth / 2,
      align: 'right',
    });

    y = 200;
    if (invoice.description) {
      doc.fillColor('#111111').fontSize(11).font('Helvetica-Bold').text('Reference', left, y);
      doc.font('Helvetica').fontSize(11).fillColor('#222222')
        .text(invoice.description, left, y + 16, { width: contentWidth });
      y = doc.y + 24;
    }

    doc.rect(left, y, contentWidth, 24).fill('#f0f4f3');
    doc.fillColor('#0f0f0d').font('Helvetica-Bold').fontSize(9);
    doc.text('Description', left + 8, y + 8, { width: contentWidth * 0.46 });
    doc.text('Qty', left + contentWidth * 0.5, y + 8, { width: contentWidth * 0.12, align: 'right' });
    doc.text('Unit price', left + contentWidth * 0.62, y + 8, { width: contentWidth * 0.18, align: 'right' });
    doc.text('Line total', left + contentWidth * 0.8, y + 8, { width: contentWidth * 0.18, align: 'right' });
    y += 28;

    doc.font('Helvetica').fontSize(10).fillColor('#222222');
    for (const it of items || []) {
      if (y > 700) {
        doc.addPage();
        y = 50;
      }
      const rowTop = y;
      doc.text(it.description || '—', left + 8, rowTop, { width: contentWidth * 0.46 });
      const rowH = Math.max(18, doc.heightOfString(it.description || '—', { width: contentWidth * 0.46 }));
      doc.text(String(Number(it.quantity)), left + contentWidth * 0.5, rowTop, {
        width: contentWidth * 0.12,
        align: 'right',
      });
      doc.text(zar(it.unit_price), left + contentWidth * 0.62, rowTop, {
        width: contentWidth * 0.18,
        align: 'right',
      });
      doc.text(zar(it.line_total), left + contentWidth * 0.8, rowTop, {
        width: contentWidth * 0.18,
        align: 'right',
      });
      y = rowTop + rowH + 10;
      doc.moveTo(left, y - 4).lineTo(right, y - 4).strokeColor('#e5e7eb').lineWidth(0.5).stroke();
    }

    y += 12;
    const totalsX = left + contentWidth * 0.55;
    const totalsW = contentWidth * 0.45;

    function totalRow(label, value) {
      doc.font('Helvetica').fontSize(10).fillColor('#111111')
        .text(label, totalsX, y, { width: totalsW * 0.45 });
      doc.text(value, totalsX + totalsW * 0.45, y, { width: totalsW * 0.55, align: 'right' });
      y += 16;
    }

    totalRow('Subtotal', zar(invoice.subtotal));
    totalRow('VAT (15%)', zar(invoice.vat_amount));
    doc.rect(totalsX, y - 2, totalsW, 26).fill('#0f0f0d');
    doc.fillColor('#00d4aa').font('Helvetica-Bold').fontSize(12)
      .text('Amount due', totalsX + 8, y + 6, { width: totalsW * 0.45 });
    doc.text(zar(invoice.balance ?? invoice.total), totalsX + totalsW * 0.4, y + 6, {
      width: totalsW * 0.55 - 8,
      align: 'right',
    });

    y += 48;
    doc.fillColor('#111111').font('Helvetica-Bold').fontSize(10).text('Payment instructions', left, y);
    doc.font('Helvetica').fontSize(9).fillColor('#444444')
      .text(
        'Please pay by EFT using your invoice number as the payment reference. Contact us if you need card or SnapScan payment options.',
        left,
        y + 16,
        { width: contentWidth }
      );

    doc.fillColor('#999999').fontSize(8)
      .text('Generated by PrintShop Pro', left, 800, { width: contentWidth, align: 'center' });

    doc.end();
  });
}
