import React from 'react';
import type { ProjectState } from '../../main/types';

export function DetailPanel({ project }: { project: ProjectState | null }) {
  if (!project) {
    return (
      <aside style={panelStyle}>
        <p style={{ color: 'var(--text-muted)' }}>点击一个项目查看它挂了哪些能力</p>
      </aside>
    );
  }
  return (
    <aside style={panelStyle}>
      <h2 className="serif" style={{ fontSize: 18, marginTop: 0 }}>
        {project.path.split('/').pop()}
      </h2>
      <div style={{ fontSize: 11, color: 'var(--text-muted)', wordBreak: 'break-all' }}>{project.path}</div>
      <Group title={`MCP (${project.mcp.length})`} items={project.mcp.map(m => m.id + (m.hasSecrets ? ' 🔑' : ''))} />
      <Group title={`Skills (${project.skills.length})`} items={project.skills.map(s => s.id)} />
      <Group title={`Plugins (${project.plugins.filter(p => p.enabled).length})`} items={project.plugins.filter(p => p.enabled).map(p => p.id)} />
    </aside>
  );
}

function Group({ title, items }: { title: string; items: string[] }) {
  return (
    <div style={{ marginTop: 16 }}>
      <div className="serif" style={{ fontSize: 13, fontWeight: 600, marginBottom: 6 }}>{title}</div>
      {items.length === 0
        ? <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>—</div>
        : items.map(i => <div key={i} style={{ fontSize: 12, padding: '2px 0' }}>{i}</div>)}
    </div>
  );
}

const panelStyle: React.CSSProperties = {
  width: 300, height: '100%', padding: 20, overflowY: 'auto',
  background: 'var(--bg-surface)', borderLeft: '1px solid var(--border)',
};
