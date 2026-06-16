import React from 'react';
import QRCode from 'react-qr-code';

/**
 * Affiche un QR code généré côté frontend.
 * @param {string} value Valeur à encoder dans le QR code
 * @param {number} size Taille du QR code en pixels (par défaut 128)
 */
export default function QrCodeLoader({ value, src, size = 128, pixelSize }) {
  const resolvedValue = value || src || ''
  const resolvedSize = pixelSize ? pixelSize * 16 : size
  return (
    <div role="img" aria-label="QR code">
      <QRCode
        value={resolvedValue}
        size={resolvedSize}
        bgColor="#fff"
        fgColor="#111"
        style={{ borderRadius: 12, boxShadow: '0 2px 12px #0001', background: '#fff', width: resolvedSize, height: resolvedSize }}
      />
    </div>
  );
}
