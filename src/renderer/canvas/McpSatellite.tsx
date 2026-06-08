import React from 'react';

export type McpStatus = 'applied' | 'pending' | 'global' | 'drift';

const STATUS_COLOR: Record<McpStatus, string> = {
  applied: 'var(--state-applied)',
  pending: 'var(--state-pending)',
  global: 'var(--accent)',
  drift: 'var(--state-drift)',
};

export function McpSatellite({ label, hasSecrets, status }: {
  label: string; hasSecrets?: boolean; status: McpStatus;
}) {
  return (
    <div style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      padding: '3px 10px', borderRadius: 14, fontSize: 11,
      background: 'var(--glass-surface)',
      backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)',
      border: '1px solid var(--glass-border)',
      boxShadow: 'var(--glass-shadow)',
      color: 'var(--text-primary)',
    }}>
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: STATUS_COLOR[status], flexShrink: 0 }} />
      {label}
      {hasSecrets && <span title="含密钥" style={{ color: 'var(--text-muted)' }}>🔑</span>}
    </div>
  );
}
