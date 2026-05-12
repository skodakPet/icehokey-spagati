import React from 'react';
import { memberColor } from './logic';

// ── AVATAR ────────────────────────────────────────────────────────────────────
export function Avatar({ member, size = 36, ring = false }) {
  const col = memberColor(member?.name || '');
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%', overflow: 'hidden', flexShrink: 0,
      border: ring ? `2px solid ${col}` : '2px solid transparent',
    }}>
      {member?.photo_url
        ? <img src={member.photo_url} alt={member.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        : <div style={{
            width: '100%', height: '100%',
            background: `${col}22`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: size * 0.38, fontWeight: 700, color: col,
          }}>
            {(member?.name || '?').slice(0, 1).toUpperCase()}
          </div>
      }
    </div>
  );
}

// ── NOTIFICATION ──────────────────────────────────────────────────────────────
export function Notification({ notif }) {
  if (!notif) return null;
  return (
    <div style={{
      position: 'fixed', top: 68, left: '50%', transform: 'translateX(-50%)',
      background: notif.type === 'warn' ? '#450A0A' : '#052E16',
      border: `1px solid ${notif.type === 'warn' ? '#EF4444' : '#34D399'}`,
      padding: '10px 22px', borderRadius: 10, zIndex: 9999,
      fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap',
      boxShadow: '0 8px 32px rgba(0,0,0,0.8)',
      animation: 'fadeUp 0.2s ease',
    }}>
      {notif.msg}
    </div>
  );
}

// ── MODAL ─────────────────────────────────────────────────────────────────────
export function Modal({ children, onClose, maxWidth = 340 }) {
  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.9)', zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
      onClick={onClose}
    >
      <div
        style={{ background: '#0F172A', border: '1px solid #1E293B', borderRadius: 16, padding: 20, maxWidth, width: '100%', animation: 'fadeUp 0.2s ease' }}
        onClick={e => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}

// ── SCORE INPUT ───────────────────────────────────────────────────────────────
export function ScoreInput({ value, onChange, placeholder, highlight }) {
  return (
    <input
      type="number" min="0" max="30"
      placeholder={placeholder}
      value={value ?? ''}
      onChange={e => onChange(e.target.value)}
      style={{
        width: 52, background: highlight ? '#1E3A5F' : '#1E293B',
        border: `1px solid ${highlight ? '#3B82F6' : '#334155'}`,
        borderRadius: 8, padding: '8px 4px', color: '#F1F5F9',
        fontSize: 20, fontWeight: 700, textAlign: 'center',
        fontFamily: "'DM Sans', system-ui",
      }}
    />
  );
}

// ── SHARED STYLES ─────────────────────────────────────────────────────────────
export const card = {
  background: '#0F172A', border: '1px solid #1E293B', borderRadius: 14, padding: '14px 13px',
};
export const inp = {
  background: '#1E293B', border: '1px solid #334155', borderRadius: 8,
  padding: '9px 11px', color: '#F1F5F9', fontSize: 13, width: '100%',
  fontFamily: "'DM Sans', system-ui",
};
export const btn = (bg = '#1E293B', color = '#F1F5F9') => ({
  border: 'none', borderRadius: 8, padding: '9px 16px', cursor: 'pointer',
  fontSize: 13, fontWeight: 600, color, background: bg,
});
export const smBtn = (color = '#475569') => ({
  border: 'none', borderRadius: 7, padding: '5px 10px', cursor: 'pointer',
  fontSize: 11, fontWeight: 500, color, background: 'rgba(255,255,255,0.05)',
});
