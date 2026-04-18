"use client";
import { useState, useEffect, useRef } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

const SLIDES = [
  {
    src: '/team-spirit.svg',
    title: 'Track together',
    body: 'Every team member has a dedicated workspace tuned to their role — QA, Dev, HR, Sales, and more.'
  },
  {
    src: '/bug-fixing-cuate.svg',
    title: 'Tapza Internal Portal',
    body: 'Report, track, and resolve bugs across Pharmacy, Clinic, Laboratory, and Hospital ERPs.'
  },
  {
    src: '/secure-server.svg',
    title: 'From PR to resolved',
    body: 'Paste a GitHub PR link and a bug is created in seconds — fully traceable from raise to ship.'
  }
];

const AUTO_ADVANCE_MS = 6000;

export default function SignInCarousel() {
  const [index, setIndex] = useState(1);
  const touchStartX = useRef(null);

  useEffect(() => {
    const t = setTimeout(() => {
      setIndex((i) => (i + 1) % SLIDES.length);
    }, AUTO_ADVANCE_MS);
    return () => clearTimeout(t);
  }, [index]);

  const go = (delta) => setIndex((i) => (i + delta + SLIDES.length) % SLIDES.length);

  const onTouchStart = (e) => { touchStartX.current = e.touches[0].clientX; };
  const onTouchEnd = (e) => {
    if (touchStartX.current == null) return;
    const dx = e.changedTouches[0].clientX - touchStartX.current;
    if (Math.abs(dx) > 50) go(dx < 0 ? 1 : -1);
    touchStartX.current = null;
  };

  return (
    <div
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
      style={{
        backgroundColor: '#f1f5f9',
        padding: '48px 40px',
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center', gap: 36,
        textAlign: 'center',
        position: 'relative',
        overflow: 'hidden'
      }}>
      <button
        type="button"
        onClick={() => go(-1)}
        aria-label="Previous slide"
        style={{
          position: 'absolute', left: 16, top: '50%', transform: 'translateY(-50%)',
          width: 36, height: 36, borderRadius: '50%',
          border: '1px solid rgba(15,23,42,0.08)',
          backgroundColor: 'rgba(255,255,255,0.7)',
          color: '#0f172a',
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer',
          backdropFilter: 'blur(10px)',
          WebkitBackdropFilter: 'blur(10px)'
        }}>
        <ChevronLeft size={18} />
      </button>

      <div style={{ position: 'relative', width: '100%', maxWidth: 420, height: 360 }}>
        {SLIDES.map((s, i) => (
          <div
            key={s.src}
            style={{
              position: 'absolute', inset: 0,
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 24,
              opacity: i === index ? 1 : 0,
              transform: `translateX(${(i - index) * 24}px)`,
              transition: 'opacity 0.5s ease, transform 0.5s ease',
              pointerEvents: i === index ? 'auto' : 'none'
            }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={s.src} alt="" style={{ width: '100%', maxWidth: 320, display: 'block' }} />
            <div>
              <h2 style={{
                fontSize: '1.5rem', fontWeight: 700,
                color: '#0f172a', margin: 0, marginBottom: 8,
                letterSpacing: '-0.02em'
              }}>{s.title}</h2>
              <p style={{
                fontSize: '0.88rem', color: '#64748b',
                margin: 0, lineHeight: 1.5, maxWidth: 340
              }}>{s.body}</p>
            </div>
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={() => go(1)}
        aria-label="Next slide"
        style={{
          position: 'absolute', right: 16, top: '50%', transform: 'translateY(-50%)',
          width: 36, height: 36, borderRadius: '50%',
          border: '1px solid rgba(15,23,42,0.08)',
          backgroundColor: 'rgba(255,255,255,0.7)',
          color: '#0f172a',
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer',
          backdropFilter: 'blur(10px)',
          WebkitBackdropFilter: 'blur(10px)'
        }}>
        <ChevronRight size={18} />
      </button>

      <div style={{ display: 'flex', gap: 6, marginTop: 24 }}>
        {SLIDES.map((_, i) => (
          <button
            key={i}
            type="button"
            aria-label={`Go to slide ${i + 1}`}
            onClick={() => setIndex(i)}
            style={{
              width: i === index ? 20 : 6,
              height: 6,
              borderRadius: 999,
              border: 'none',
              padding: 0,
              backgroundColor: i === index ? '#0f172a' : '#cbd5e1',
              cursor: 'pointer',
              transition: 'width 0.25s ease, background-color 0.25s ease'
            }}
          />
        ))}
      </div>
    </div>
  );
}
