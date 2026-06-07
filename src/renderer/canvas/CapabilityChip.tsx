import React from 'react';

const BAR: Record<string, string> = {
  mcp: '#D97757',     // 陶土橙
  skill: '#5B7553',   // 橄榄绿
  plugin: '#C2965A',  // 琥珀
};

export function CapabilityChip(props: {
  kind: 'mcp' | 'skill' | 'plugin';
  label: string;
  hasSecrets?: boolean;
}) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 6,
      padding: '4px 10px 4px 8px', margin: 3, borderRadius: 8,
      background: 'var(--bg-surface)', border: '1px solid var(--border)',
      fontSize: 12, color: 'var(--text-primary)',
    }}>
      <span style={{ width: 3, height: 14, borderRadius: 2, background: BAR[props.kind] }} />
      {props.label}
      {props.hasSecrets && <span title="含密钥" style={{ color: 'var(--text-muted)' }}>🔑</span>}
    </span>
  );
}
