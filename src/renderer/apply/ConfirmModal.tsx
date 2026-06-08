import React from 'react';
import { motion } from 'motion/react';
import { springSmooth, springSnappy } from '../theme/springs';

// iOS 手感的弹窗:背景模糊淡入,卡片用 spring 从略小处弹出
export function ConfirmModal({ title, body, confirmLabel, onConfirm, onCancel }: {
  title: string; body: string; confirmLabel: string; onConfirm: () => void; onCancel: () => void;
}) {
  return (
    <motion.div
      onClick={onCancel}
      initial={{ opacity: 0, backdropFilter: 'blur(0px)' }}
      animate={{ opacity: 1, backdropFilter: 'blur(8px)' }}
      exit={{ opacity: 0, backdropFilter: 'blur(0px)' }}
      transition={{ duration: 0.2, ease: 'easeOut' }}
      style={{ position: 'fixed', inset: 0, background: 'rgba(40,36,33,.28)', display: 'grid', placeItems: 'center', zIndex: 60 }}
    >
      <motion.div
        onClick={e => e.stopPropagation()}
        initial={{ scale: 0.92, opacity: 0, y: 8 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.96, opacity: 0, y: 4 }}
        transition={springSmooth}
        style={{ width: 460, background: 'var(--glass-surface-strong)', backdropFilter: 'blur(20px) saturate(180%)', WebkitBackdropFilter: 'blur(20px) saturate(180%)', border: '1px solid var(--glass-border)', borderRadius: 18, padding: 20, boxShadow: 'var(--glass-shadow)' }}
      >
        <h2 className="serif" style={{ marginTop: 0, fontSize: 18 }}>{title}</h2>
        <p style={{ fontSize: 13, color: 'var(--text-primary)', lineHeight: 1.6 }}>{body}</p>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
          <motion.button
            onClick={onCancel}
            whileTap={{ scale: 0.96 }}
            transition={springSnappy}
            style={{ padding: '6px 14px', borderRadius: 10, border: '1px solid var(--border)', background: 'var(--bg-canvas)', color: 'var(--text-primary)', cursor: 'pointer' }}
          >取消</motion.button>
          <motion.button
            onClick={onConfirm}
            whileTap={{ scale: 0.96 }}
            transition={springSnappy}
            style={{ padding: '6px 14px', borderRadius: 10, border: 'none', background: 'var(--state-drift)', color: '#fff', cursor: 'pointer' }}
          >{confirmLabel}</motion.button>
        </div>
      </motion.div>
    </motion.div>
  );
}
