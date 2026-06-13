/**
 * Shared PDF QR drawer.
 *
 * Lifted from member/certificates/utils/certificate-template.ts (FIX-005) so the
 * member ID card (FIX-001) and certificates render scannable verify QRs from one
 * implementation. Draws the qrcode-svg module matrix directly as filled vector
 * squares — no raster/SVG dependency — so a verifier can scan straight to the
 * public verify endpoint.
 */

import { rgb, type PDFPage } from 'pdf-lib';
import QRCode from 'qrcode-svg';

export function drawQrCode(page: PDFPage, opts: { x: number; y: number; size: number; data: string }): void {
  const qr = new QRCode({ content: opts.data, padding: 1, ecl: 'M' });
  const modules = qr.qrcode.modules;
  const count = modules.length;
  const cell = opts.size / count;
  // White quiet-zone background so the code is scannable on any page color.
  page.drawRectangle({ x: opts.x, y: opts.y, width: opts.size, height: opts.size, color: rgb(1, 1, 1) });
  for (let r = 0; r < count; r++) {
    for (let c = 0; c < count; c++) {
      if (modules[r]![c]) {
        page.drawRectangle({
          // PDF origin is bottom-left; matrix row 0 is the top row → flip y.
          x: opts.x + c * cell,
          y: opts.y + opts.size - (r + 1) * cell,
          width: cell,
          height: cell,
          color: rgb(0, 0, 0),
        });
      }
    }
  }
}
