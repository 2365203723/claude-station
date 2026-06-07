import React from 'react';
import type { NodeProps } from 'reactflow';
import { CapabilityChip } from './CapabilityChip';
import type { ProjectState } from '../../main/types';

export function ProjectNode({ data }: NodeProps<ProjectState>) {
  const name = data.path.split('/').pop() || data.path;
  const summary = `${data.mcp.length} MCP · ${data.skills.length} skill · ${data.plugins.filter(p => p.enabled).length} plugin`;
  return (
    <div style={{
      width: 260, background: 'var(--bg-surface)',
      border: '1px solid var(--border)', borderRadius: 12,
      boxShadow: 'var(--shadow)', padding: 16,
    }}>
      <div className="serif" style={{ fontSize: 16, fontWeight: 600 }}>{name}</div>
      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2, marginBottom: 10 }}>{summary}</div>
      <div style={{ display: 'flex', flexWrap: 'wrap' }}>
        {data.mcp.map(m => <CapabilityChip key={'m'+m.id} kind="mcp" label={m.id} hasSecrets={m.hasSecrets} />)}
        {data.skills.map(s => <CapabilityChip key={'s'+s.id} kind="skill" label={s.id} />)}
        {data.plugins.filter(p => p.enabled).map(p => <CapabilityChip key={'p'+p.id} kind="plugin" label={p.id.split('@')[0]} />)}
      </div>
    </div>
  );
}
