import React from 'react';

export function GlobalCleanupSection({ status, onRetire }: {
  status: { eligible: string[]; blocked: string[] } | null;
  onRetire: (id: string) => void;
}) {
  if (!status || (status.eligible.length === 0 && status.blocked.length === 0)) return null;
  return (
    <div style={{ marginTop: 18, borderTop: '1px solid var(--border)', paddingTop: 12 }}>
      <div className="serif" style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>全局注入</div>
      {status.eligible.map(id => (
        <div key={id} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 0', fontSize: 12 }}>
          <span title="已落地,可清理" style={{ color: 'var(--state-applied)' }}>🟢</span>
          <span>{id}</span>
          <button onClick={() => onRetire(id)} style={{ marginLeft: 'auto', fontSize: 11, padding: '2px 8px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg-surface)', color: 'var(--state-drift)', cursor: 'pointer' }}>退役</button>
        </div>
      ))}
      {status.blocked.map(id => (
        <div key={id} title="未落地到任何项目,不能清理" style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 0', fontSize: 12, color: 'var(--text-muted)' }}>
          <span>🔒</span><span>{id}</span><span style={{ marginLeft: 'auto', fontSize: 10 }}>未落地</span>
        </div>
      ))}
    </div>
  );
}
