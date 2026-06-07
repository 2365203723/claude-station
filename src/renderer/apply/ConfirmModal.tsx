import React from 'react';

export function ConfirmModal({ title, body, confirmLabel, onConfirm, onCancel }: {
  title: string; body: string; confirmLabel: string; onConfirm: () => void; onCancel: () => void;
}) {
  return (
    <div onClick={onCancel} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.35)', display: 'grid', placeItems: 'center', zIndex: 60 }}>
      <div onClick={e => e.stopPropagation()} style={{ width: 460, background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 20, boxShadow: 'var(--shadow)' }}>
        <h2 className="serif" style={{ marginTop: 0, fontSize: 18 }}>{title}</h2>
        <p style={{ fontSize: 13, color: 'var(--text-primary)', lineHeight: 1.6 }}>{body}</p>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
          <button onClick={onCancel} style={{ padding: '6px 14px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-canvas)', color: 'var(--text-primary)', cursor: 'pointer' }}>取消</button>
          <button onClick={onConfirm} style={{ padding: '6px 14px', borderRadius: 8, border: 'none', background: 'var(--state-drift)', color: '#fff', cursor: 'pointer' }}>{confirmLabel}</button>
        </div>
      </div>
    </div>
  );
}
