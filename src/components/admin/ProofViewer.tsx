"use client";

import { useRef, useState } from "react";

const STEPS = [0.5, 0.75, 1, 1.5, 2, 3, 4];

// Payment screenshot: a thumbnail that opens an in-page viewer with zoom and
// rotate, so operators never need to download the file to review it.
export default function ProofViewer({
  src,
  label,
  compact = false,
}: {
  src: string;
  label: string;
  compact?: boolean;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [zoom, setZoom] = useState(2); // index into STEPS; 1× by default
  const [rotation, setRotation] = useState(0);
  const [failed, setFailed] = useState(false);

  function open() {
    setZoom(2);
    setRotation(0);
    dialogRef.current?.showModal();
  }

  if (failed) {
    return <div className="adm-proof-missing">Screenshot could not be displayed.</div>;
  }

  const scale = STEPS[zoom];

  return (
    <>
      <button
        type="button"
        className={compact ? "adm-proof-thumb compact" : "adm-proof-thumb"}
        onClick={open}
        title="View screenshot"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} alt={label} loading="lazy" onError={() => setFailed(true)} />
        <span>🔍 View</span>
      </button>
      <dialog ref={dialogRef} className="adm-lightbox" aria-label={label}>
        <div className="adm-lightbox-bar">
          <strong>{label}</strong>
          <div className="adm-lightbox-tools">
            <button
              type="button"
              onClick={() => setZoom((z) => Math.max(0, z - 1))}
              disabled={zoom === 0}
              aria-label="Zoom out"
            >
              −
            </button>
            <span className="adm-mono">{Math.round(scale * 100)}%</span>
            <button
              type="button"
              onClick={() => setZoom((z) => Math.min(STEPS.length - 1, z + 1))}
              disabled={zoom === STEPS.length - 1}
              aria-label="Zoom in"
            >
              +
            </button>
            <button type="button" onClick={() => setZoom(2)}>
              Fit
            </button>
            <button
              type="button"
              onClick={() => setRotation((r) => (r + 90) % 360)}
              aria-label="Rotate"
            >
              ⟳
            </button>
            <a href={src} target="_blank" rel="noopener noreferrer">
              Open original
            </a>
            <button
              type="button"
              onClick={() => dialogRef.current?.close()}
              aria-label="Close"
            >
              ✕
            </button>
          </div>
        </div>
        <div className="adm-lightbox-stage">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={src}
            alt={label}
            style={{
              transform: `rotate(${rotation}deg)`,
              width: `${scale * 100}%`,
              maxWidth: scale <= 1 ? "100%" : "none",
            }}
            onDoubleClick={() => setZoom((z) => (z === 2 ? 4 : 2))}
          />
        </div>
      </dialog>
    </>
  );
}
