declare module 'qrcode-svg' {
  interface QRCodeOptions {
    content: string;
    padding?: number;
    width?: number;
    height?: number;
    color?: string;
    background?: string;
    ecl?: 'L' | 'M' | 'H' | 'Q';
  }
  class QRCode {
    constructor(options: QRCodeOptions | string);
    qrcode: { moduleCount: number; modules: boolean[][] };
    svg(): string;
  }
  export = QRCode;
}
