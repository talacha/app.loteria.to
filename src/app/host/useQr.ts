import { useEffect, useState } from 'react';
import QRCode from 'qrcode';

/** QR as a data URL: black on white with a 4-module quiet zone for reliable scanning. */
export function useQr(text: string, width = 640): string {
  const [url, setUrl] = useState('');
  useEffect(() => {
    let alive = true;
    QRCode.toDataURL(text, {
      margin: 4,
      width,
      errorCorrectionLevel: 'M',
      color: { dark: '#000000', light: '#ffffff' },
    })
      .then((u) => alive && setUrl(u))
      .catch(() => alive && setUrl(''));
    return () => {
      alive = false;
    };
  }, [text, width]);
  return url;
}
