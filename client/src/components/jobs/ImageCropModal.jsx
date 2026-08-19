import { useCallback, useEffect, useRef, useState } from 'react';
import { IconClose } from '../icons/Icons';
import './ImageCropModal.css';

const ASPECT = 16 / 9;

export default function ImageCropModal({ imageSrc, onCancel, onSave, title = 'Adjust cover' }) {
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const dragStart = useRef({ x: 0, y: 0, ox: 0, oy: 0 });
  const frameRef = useRef(null);
  const imgRef = useRef(null);

  const clampOffset = useCallback((ox, oy, sc) => {
    const frame = frameRef.current;
    const img = imgRef.current;
    if (!frame || !img) return { x: ox, y: oy };

    const fw = frame.clientWidth;
    const fh = frame.clientHeight;
    const iw = img.naturalWidth * sc;
    const ih = img.naturalHeight * sc;
    const maxX = Math.max(0, (iw - fw) / 2);
    const maxY = Math.max(0, (ih - fh) / 2);

    return {
      x: Math.min(maxX, Math.max(-maxX, ox)),
      y: Math.min(maxY, Math.max(-maxY, oy)),
    };
  }, []);

  useEffect(() => {
    const img = new Image();
    img.onload = () => {
      const frame = frameRef.current;
      if (!frame) return;
      const fw = frame.clientWidth;
      const fh = frame.clientHeight;
      const fit = Math.max(fw / img.naturalWidth, fh / img.naturalHeight);
      setScale(fit);
      setOffset({ x: 0, y: 0 });
    };
    img.src = imageSrc;
  }, [imageSrc]);

  const onPointerDown = (e) => {
    setDragging(true);
    dragStart.current = { x: e.clientX, y: e.clientY, ox: offset.x, oy: offset.y };
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e) => {
    if (!dragging) return;
    const dx = e.clientX - dragStart.current.x;
    const dy = e.clientY - dragStart.current.y;
    setOffset(clampOffset(dragStart.current.ox + dx, dragStart.current.oy + dy, scale));
  };

  const onPointerUp = () => setDragging(false);

  const handleSave = () => {
    const frame = frameRef.current;
    const img = imgRef.current;
    if (!frame || !img) return;

    const fw = frame.clientWidth;
    const fh = frame.clientHeight;
    const canvas = document.createElement('canvas');
    canvas.width = 1200;
    canvas.height = Math.round(1200 / ASPECT);
    const ctx = canvas.getContext('2d');
    const drawScale = canvas.width / fw;

    const iw = img.naturalWidth * scale * drawScale;
    const ih = img.naturalHeight * scale * drawScale;
    const cx = canvas.width / 2 + offset.x * drawScale;
    const cy = canvas.height / 2 + offset.y * drawScale;

    ctx.drawImage(img, cx - iw / 2, cy - ih / 2, iw, ih);

    canvas.toBlob((blob) => {
      if (!blob) return;
      const file = new File([blob], 'cover.jpg', { type: 'image/jpeg' });
      onSave(file, canvas.toDataURL('image/jpeg', 0.92));
    }, 'image/jpeg', 0.92);
  };

  return (
    <div className="crop-modal-backdrop" role="presentation">
      <div className="crop-modal" role="dialog" aria-modal="true">
        <div className="crop-modal__head">
          <h2>{title}</h2>
          <button type="button" onClick={onCancel} aria-label="Close"><IconClose size={18} /></button>
        </div>
        <p className="crop-modal__hint">Drag to reposition · Use the slider to zoom</p>
        <div
          ref={frameRef}
          className="crop-modal__frame"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        >
          <img
            ref={imgRef}
            src={imageSrc}
            alt=""
            className="crop-modal__img"
            style={{
              transform: `translate(calc(-50% + ${offset.x}px), calc(-50% + ${offset.y}px)) scale(${scale})`,
            }}
            draggable={false}
          />
        </div>
        <label className="crop-modal__zoom">
          Zoom
          <input
            type="range"
            min="0.5"
            max="3"
            step="0.01"
            value={scale}
            onChange={(e) => {
              const sc = Number(e.target.value);
              setScale(sc);
              setOffset((o) => clampOffset(o.x, o.y, sc));
            }}
          />
        </label>
        <div className="crop-modal__actions">
          <button type="button" className="crop-modal__btn" onClick={onCancel}>Cancel</button>
          <button type="button" className="crop-modal__btn crop-modal__btn--primary" onClick={handleSave}>Save cover</button>
        </div>
      </div>
    </div>
  );
}
