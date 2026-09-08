"use client";

import Image from "next/image";
import { ReturnArrow } from "@/components/social-hub";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import styles from "./photo-album.module.css";

const photos = [
  { file: "7419", width: 1824, height: 1368, alt: "Two children opening Christmas presents beside an adult in the living room." },
  { file: "7418", width: 1824, height: 1368, alt: "A birthday table with green balloons, a cake, and children opening gifts." },
  { file: "7415", width: 1927, height: 1279, alt: "Two children in matching sports shirts unwrapping presents on the floor." },
  { file: "7414", width: 720, height: 960, alt: "Three children riding hoverboards together in the living room." },
  { file: "7420", width: 960, height: 540, alt: "Three children gathered around a baby in a bouncer." },
  { file: "7421", width: 720, height: 960, alt: "Two children opening presents by the couch, with an adult behind them." },
  { file: "7422", width: 1824, height: 1368, alt: "Two children surrounded by wrapping paper and LEGO boxes on Christmas morning." },
];

/** Spread family photos, then open an individual photo in a keyboard-accessible modal. */
export function PhotoAlbum() {
  const [hovered, setHovered] = useState(false);
  const [pinned, setPinned] = useState(false);
  const [selected, setSelected] = useState<number | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const expanded = hovered || pinned;
  const viewerOpen = selected !== null;
  const touchStart = useRef<{ x: number; y: number } | null>(null);

  /** Move through the album without closing the modal or moving keyboard focus. */
  function movePhoto(direction: number) {
    setSelected(current => current === null ? null : (current + direction + photos.length) % photos.length);
  }

  useEffect(() => {
    if (!viewerOpen) return;
    const viewer = dialog.current;
    const overflow = document.body.style.overflow;
    viewer?.showModal();
    document.body.style.overflow = "hidden";
    return () => {
      viewer?.close();
      document.body.style.overflow = overflow;
    };
  }, [viewerOpen]);

  return <><figure className={styles.broPhotos} data-expanded={expanded}
    onPointerLeave={() => setHovered(false)}>
    <div className={styles.broPhotoStage} id="bro-photo-album" tabIndex={expanded ? 0 : -1} aria-label="Seven family photos. Scroll horizontally when spread on a small screen.">
      <ol className={styles.broPhotoTrack}>
        {photos.map((photo, index) => <li className={styles.broPhoto} key={photo.file} data-portrait={photo.height > photo.width}
          style={{ "--photo-index": index } as CSSProperties}>
          <button type="button" onPointerEnter={event => { if (event.pointerType === "mouse") setHovered(true); }} aria-label={expanded ? `Enlarge photo ${index + 1}: ${photo.alt}` : "Spread the photos"}
            onClick={() => {
              if (!expanded) setPinned(true);
              else { setPinned(true); setSelected(index); }
            }}>
          <Image src={`/writings/big-bro/${photo.file}.webp`} width={photo.width} height={photo.height} alt={photo.alt} sizes="(max-width: 640px) 240px, 250px" />
          </button>
        </li>)}
      </ol>
    </div>
    <figcaption>
      <span>a few from the family album</span>
      <button type="button" aria-controls="bro-photo-album" aria-expanded={expanded} onClick={() => {
        setPinned(!pinned);
        setHovered(false);
      }}>{pinned ? "pile them back up" : expanded ? "keep them out" : "spread the photos"}<span aria-hidden="true"> {pinned ? "−" : "+"}</span></button>
    </figcaption>
  </figure>
    <dialog ref={dialog} className={styles.broPhotoViewer} aria-label="Family photo album"
      onCancel={() => setSelected(null)}
      onKeyDown={event => {
        if (event.key === "ArrowRight" || event.key === "ArrowLeft") {
          event.preventDefault();
          movePhoto(event.key === "ArrowRight" ? 1 : -1);
        }
      }}
      onClick={event => { if (event.target === event.currentTarget) setSelected(null); }}>
      {selected !== null && <div className={styles.broPhotoViewerContent} style={{ "--photo-ratio": photos[selected].width / photos[selected].height } as CSSProperties}>
        <header className={styles.broPhotoToolbar}>
          <button type="button" className={styles.broPhotoBack} onClick={() => setSelected(null)} aria-label="Back to note">
            <ReturnArrow /><span>Back</span>
          </button>
        </header>
        <div className={styles.broPhotoFrame}
          onClick={event => { if (event.target === event.currentTarget) setSelected(null); }}
          onTouchStart={event => {
            touchStart.current = event.touches.length === 1 ? { x: event.touches[0].clientX, y: event.touches[0].clientY } : null;
          }}
          onTouchCancel={() => { touchStart.current = null; }}
          onTouchEnd={event => {
            const start = touchStart.current;
            touchStart.current = null;
            if (!start || event.touches.length) return;
            const dx = event.changedTouches[0].clientX - start.x;
            const dy = event.changedTouches[0].clientY - start.y;
            if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5) movePhoto(dx < 0 ? 1 : -1);
          }}>
          <button className={styles.broPhotoPrev} type="button" onClick={() => movePhoto(-1)} aria-label="Previous photo"><span aria-hidden="true">←</span></button>
          <Image key={photos[selected].file} src={`/writings/big-bro/${photos[selected].file}.webp`}
            width={photos[selected].width} height={photos[selected].height}
            alt={photos[selected].alt} sizes="(max-width: 640px) 90vw, 90vw" loading="eager" />
          <button className={styles.broPhotoNext} type="button" onClick={() => movePhoto(1)} aria-label="Next photo"><span aria-hidden="true">→</span></button>
        </div>
        <footer className={styles.broPhotoNavigation}>
          <span className={styles.broPhotoCount} aria-live="polite" aria-atomic="true">{selected + 1} / {photos.length}</span>
        </footer>
      </div>}
    </dialog>
  </>;
}
