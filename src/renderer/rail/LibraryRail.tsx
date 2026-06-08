import React, { useState } from 'react';
import type { LibraryMcp, LibrarySkill, LibraryPlugin, LibrarySnippet } from '../../main/station/types';

const BAR: Record<string, string> = { mcp: '#D97757', skill: '#5B7553', plugin: '#C2965A', snippet: '#7B8DB5' };

function Chip({ id, kind, hasSecret, onDragStart, onDragEnd }: {
  id: string; kind: string; hasSecret?: boolean;
  onDragStart?: (kind: string, id: string) => void;
  onDragEnd?: () => void;
}) {
  return (
    <div
      draggable
      onDragStart={e => {
        e.dataTransfer.setData('application/x-station-item', JSON.stringify({ kind, id }));
        e.dataTransfer.effectAllowed = 'copy';
        onDragStart?.(kind, id);
      }}
      onDragEnd={() => onDragEnd?.()}
      style={{
        display: 'flex', alignItems: 'center', gap: 6, cursor: 'grab',
        padding: '6px 10px', marginBottom: 6, borderRadius: 8,
        background: 'var(--glass-surface)', border: '1px solid var(--glass-border)', fontSize: 12,
        backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)',
      }}>
      <span style={{ width: 3, height: 14, borderRadius: 2, background: BAR[kind] ?? '#999' }} />
      {id}
      {hasSecret && <span title="含密钥" style={{ marginLeft: 'auto', color: 'var(--text-muted)' }}>🔑</span>}
    </div>
  );
}

function Section({ title, empty, children, defaultOpen }: { title: string; empty: boolean; children: React.ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen ?? true);
  return (
    <div style={{ marginBottom: 4 }}>
      <div
        className="serif"
        onClick={() => setOpen(o => !o)}
        style={{ fontSize: 13, fontWeight: 600, marginBottom: open ? 8 : 2, cursor: 'pointer', userSelect: 'none', display: 'flex', alignItems: 'center', gap: 4 }}>
        <span style={{ fontSize: 10, transition: 'transform 0.15s', transform: open ? 'rotate(90deg)' : 'none' }}>▶</span>
        {title}
      </div>
      {open && (
        <div>
          {empty ? <div style={{ fontSize: 12, color: 'var(--text-muted)', paddingLeft: 14 }}>—</div> : children}
        </div>
      )}
    </div>
  );
}

export function LibraryRail({ mcp, skills, plugins, snippets, onDragStartItem, onDragEndItem }: {
  mcp: LibraryMcp[];
  skills: LibrarySkill[];
  plugins: LibraryPlugin[];
  snippets: LibrarySnippet[];
  onDragStartItem?: (kind: string, id: string) => void;
  onDragEndItem?: () => void;
}) {
  const total = mcp.length + skills.length + plugins.length + snippets.length;
  return (
    <aside style={{ width: 200, background: 'var(--bg-rail)', borderRight: '1px solid var(--border)', padding: 16, overflowY: 'auto' }}>
      <div className="serif" style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>
        能力库 {total > 0 && <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 400 }}>({total})</span>}
      </div>

      <Section title={`MCP 服务器 (${mcp.length})`} empty={mcp.length === 0}>
        {mcp.map(m => <Chip key={m.id} id={m.id} kind="mcp" hasSecret={m.hasSecrets} onDragStart={onDragStartItem} onDragEnd={onDragEndItem} />)}
      </Section>

      <Section title={`Skills (${skills.length})`} empty={skills.length === 0} defaultOpen={skills.length > 0}>
        {skills.map(s => <Chip key={s.id} id={s.id} kind="skill" onDragStart={onDragStartItem} onDragEnd={onDragEndItem} />)}
      </Section>

      <Section title={`Plugins (${plugins.length})`} empty={plugins.length === 0} defaultOpen={plugins.length > 0}>
        {plugins.map(p => <Chip key={p.id} id={p.id} kind="plugin" onDragStart={onDragStartItem} onDragEnd={onDragEndItem} />)}
      </Section>

      <Section title={`配置片段 (${snippets.length})`} empty={snippets.length === 0} defaultOpen={snippets.length > 0}>
        {snippets.map(s => <Chip key={s.id} id={s.id} kind="snippet" onDragStart={onDragStartItem} onDragEnd={onDragEndItem} />)}
      </Section>
    </aside>
  );
}
