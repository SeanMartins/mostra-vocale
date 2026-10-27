import React, { useEffect, useState } from 'react';
import QRCode from 'qrcode';

export function useQrDataUrl(text, size = 480) {
  const [url, setUrl] = useState('');
  useEffect(() => {
    let alive = true;
    QRCode.toDataURL(text, { margin: 1, width: size, errorCorrectionLevel: 'M', color: { dark: '#111113', light: '#FFFFFF' } })
      .then((u) => alive && setUrl(u))
      .catch(() => alive && setUrl(''));
    return () => {
      alive = false;
    };
  }, [text, size]);
  return url;
}

export default function QrCode({ text, size = 160, alt }) {
  const url = useQrDataUrl(text, size * 3);
  return url ? (
    <img className="qr" src={url} width={size} height={size} alt={alt || `Codice QR per ${text}`} />
  ) : (
    <span className="qr qr--placeholder" style={{ width: size, height: size }} />
  );
}
