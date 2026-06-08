import React from 'react';
import { motion } from 'motion/react';
import type { ApplyPlan } from '../../main/station/types';
import { springSmooth, springSnappy } from '../theme/springs';
import { RubberScroll } from '../theme/RubberScroll';

const KIND_LABEL: Record<string, string> = {
  mcpjson: '.mcp.json',
  localscope: '本地作用域',
  skills: 'Skills (symlink)',
  settings: 'settings.json',
  claudemd: 'CLAUDE.md',
};

export function DiffModal({ plan, onConfirm, onCancel }: {
  plan: ApplyPlan | null; onConfirm: () => void; onCancel: () => void;
}) {
  if (!plan) return null;
  return (
    <motion.div
      onClick={onCancel}
      initial={{ opacity: 0, backdropFilter: 'blur(0px)' }}
      animate={{ opacity: 1, backdropFilter: 'blur(8px)' }}
      exit={{ opacity: 0, backdropFilter: 'blur(0px)' }}
      transition={{ duration: 0.2, ease: 'easeOut' }}
      style={{ position: 'fixed', inset: 0, background: 'rgba(40,36,33,.28)', display: 'grid', placeItems: 'center', zIndex: 50 }}
    >
      <motion.div
        onClick={e => e.stopPropagation()}
        initial={{ scale: 0.92, opacity: 0, y: 8 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.96, opacity: 0, y: 4 }}
        transition={springSmooth}
        style={{ width: 640, maxHeight: '80vh', display: 'flex', flexDirection: 'column',
          background: 'var(--glass-surface-strong)', backdropFilter: 'blur(20px) saturate(180%)', WebkitBackdropFilter: 'blur(20px) saturate(180%)',
          border: '1px solid var(--glass-border)', borderRadius: 18, padding: 20, boxShadow: 'var(--glass-shadow)' }}
      >
        <h2 className="serif" style={{ marginTop: 0, fontSize: 18 }}>待写入更改</h2>
        <RubberScroll style={{ overflowY: 'auto', flex: 1, marginRight: -4, paddingRight: 4 }}>
          {plan.changes.length === 0 && <p style={{ color: 'var(--text-muted)' }}>无更改</p>}
          {plan.changes.map((c, i) => (
            <div key={i} style={{ marginBottom: 14 }}>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-muted)', wordBreak: 'break-all' }}>
                {KIND_LABEL[c.kind] ?? c.kind} · {c.file}
              </div>
              {c.added.map(id => <div key={'a'+id} style={{ fontSize: 12, color: 'var(--state-applied)' }}>+ {id}</div>)}
              {c.changed.map(id => <div key={'c'+id} style={{ fontSize: 12, color: 'var(--state-pending)' }}>~ {id}</div>)}
              {c.removed.map(id => <div key={'r'+id} style={{ fontSize: 12, color: 'var(--state-drift)' }}>- {id}</div>)}
            </div>
          ))}
        </RubberScroll>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
          <motion.button onClick={onCancel} whileTap={{ scale: 0.96 }} transition={springSnappy}
            style={{ padding: '6px 14px', borderRadius: 10, border: '1px solid var(--border)', background: 'var(--bg-canvas)', color: 'var(--text-primary)', cursor: 'pointer' }}>取消</motion.button>
          <motion.button onClick={onConfirm} disabled={plan.changes.length === 0} whileTap={{ scale: 0.96 }} transition={springSnappy}
            style={{ padding: '6px 14px', borderRadius: 10, border: 'none', background: 'var(--accent)', color: '#fff', cursor: plan.changes.length === 0 ? 'default' : 'pointer', opacity: plan.changes.length === 0 ? 0.5 : 1 }}>确认写入</motion.button>
        </div>
      </motion.div>
    </motion.div>
  );
}
