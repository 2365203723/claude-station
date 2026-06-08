import React from 'react';
import type { NodeProps } from 'reactflow';
import { McpSatellite, type McpStatus } from './McpSatellite';
import type { LibraryMcp, LibrarySkill, LibraryPlugin, LibrarySnippet } from '../../main/station/types';
import type { PlanetPosition } from './orbitLayout';
import type { DragItem } from './Canvas';

interface ProjectPlanetData extends PlanetPosition {
  name: string;
  mcp: { id: string; hasSecrets: boolean; status: McpStatus }[];
  skills: string[];
  plugins: string[];
  snippets: string[];
  libraryMcp: Record<string, LibraryMcp>;
  librarySkills: Record<string, LibrarySkill>;
  libraryPlugins: Record<string, LibraryPlugin>;
  librarySnippets: Record<string, LibrarySnippet>;
  draggingItem: DragItem | null;
  isDragOver: boolean;
  onDropItem?: (path: string, kind: string, id: string) => void;
  onUnassignMcp?: (path: string, mcpId: string) => void;
  onSelect?: () => void;
}

const TYPE_COLORS: Record<string, string> = { mcp: '#D97757', skill: '#5B7553', plugin: '#C2965A', snippet: '#7B8DB5' };

export function ProjectPlanet({ data }: NodeProps<ProjectPlanetData>) {
  const { name, mcp = [], skills = [], plugins = [], snippets = [], planetRadius, orbitRadius, draggingItem, isDragOver } = data;
  const libraryMcp = data.libraryMcp ?? {};
  const librarySkills = data.librarySkills ?? {};
  const libraryPlugins = data.libraryPlugins ?? {};
  const librarySnippets = data.librarySnippets ?? {};
  const draggingMcpId = draggingItem?.kind === 'mcp' ? draggingItem.id : null;
  const satAngle = (idx: number) => (idx / Math.max(mcp.length, 1)) * 2 * Math.PI - Math.PI / 2;

  // 计算摘要行各部分
  const parts: { label: string; kind: string }[] = [];
  if (mcp.length > 0) parts.push({ label: `${mcp.length} MCP`, kind: 'mcp' });
  if (skills.length > 0) parts.push({ label: `${skills.length} Skill`, kind: 'skill' });
  if (plugins.length > 0) parts.push({ label: `${plugins.length} Plugin`, kind: 'plugin' });
  if (snippets.length > 0) parts.push({ label: `${snippets.length} 片段`, kind: 'snippet' });

  // 检查被拖拽 item 对应的 library 信息(用于 snap preview)
  const draggedItemLabel = draggingItem ? (() => {
    if (draggingItem.kind === 'mcp') return libraryMcp[draggingItem.id]?.id;
    if (draggingItem.kind === 'skill') return librarySkills[draggingItem.id]?.id;
    if (draggingItem.kind === 'plugin') return libraryPlugins[draggingItem.id]?.id;
    if (draggingItem.kind === 'snippet') return librarySnippets[draggingItem.id]?.id;
    return null;
  })() : null;

  return (
    <div
      onDrop={e => {
        e.preventDefault();
        const raw = e.dataTransfer.getData('application/x-station-item');
        if (raw) {
          try {
            const item = JSON.parse(raw);
            if (item.kind && item.id && data.onDropItem) data.onDropItem(data.path, item.kind, item.id);
            return;
          } catch { /* fall through to legacy */ }
        }
        const id = e.dataTransfer.getData('application/x-mcp-id');
        if (id && data.onDropItem) data.onDropItem(data.path, 'mcp', id);
      }}
      style={{ position: 'relative', width: planetRadius * 2 + orbitRadius * 2 + 20, height: planetRadius * 2 + orbitRadius * 2 + 20 }}
    >
      {/* Gravity glow */}
      {isDragOver && (
        <div style={{
          position: 'absolute', inset: 0, borderRadius: '50%',
          background: 'radial-gradient(circle, var(--gravity-glow), transparent 70%)',
          opacity: .7, zIndex: 0, pointerEvents: 'none',
          transition: 'opacity 0.2s ease',
        }} />
      )}

      {/* Orbit ring */}
      {mcp.length > 0 && (
        <div style={{
          position: 'absolute', left: '50%', top: '50%',
          width: orbitRadius * 2 + planetRadius * 2,
          height: orbitRadius * 2 + planetRadius * 2,
          transform: 'translate(-50%,-50%)',
          borderRadius: '50%',
          border: `1px solid ${isDragOver ? 'var(--orbit-line-active)' : 'var(--orbit-line)'}`,
          zIndex: 0, pointerEvents: 'none',
          transition: 'border-color 0.3s cubic-bezier(0.34,1.56,0.64,1)',
        }} />
      )}

      {/* Planet body */}
      <div
        className="serif"
        onClick={() => data.onSelect?.()}
        style={{
          position: 'absolute', left: '50%', top: '50%',
          width: planetRadius * 2, height: planetRadius * 2,
          transform: 'translate(-50%,-50%)',
          background: 'var(--planet-bg)',
          backdropFilter: 'blur(18px) saturate(1.3)',
          WebkitBackdropFilter: 'blur(18px) saturate(1.3)',
          borderRadius: '50%',
          border: '1px solid var(--glass-border)',
          boxShadow: `${isDragOver ? '0 0 28px var(--accent),' : ''} var(--glass-shadow), inset 0 2px 14px var(--glass-highlight)`,
          zIndex: 2, display: 'flex', flexDirection: 'column', alignItems: 'center',
          justifyContent: 'center', gap: 3,
          cursor: 'pointer', userSelect: 'none',
          transition: 'box-shadow 0.3s cubic-bezier(0.34,1.56,0.64,1), transform 0.3s cubic-bezier(0.34,1.56,0.64,1)',
          fontSize: Math.max(11, Math.round(planetRadius / 3.5)),
          fontWeight: 600, color: 'var(--text-primary)',
        }}>
        <span>{name}</span>
        {parts.length > 0 ? (
          <span style={{ fontSize: Math.max(8, Math.round(planetRadius / 5.5)),
            color: 'var(--text-muted)', fontWeight: 400, display: 'flex', gap: 4, flexWrap: 'wrap', justifyContent: 'center', padding: '0 4px' }}>
            {parts.map((p, i) => (
              <span key={p.kind} style={{ display: 'inline-flex', alignItems: 'center', gap: 2 }}>
                {i > 0 && <span style={{ opacity: .5 }}>·</span>}
                <span style={{ width: 5, height: 5, borderRadius: '50%', background: TYPE_COLORS[p.kind] ?? '#999', flexShrink: 0 }} />
                {p.label}
              </span>
            ))}
          </span>
        ) : (
          <span style={{ fontSize: Math.max(9, Math.round(planetRadius / 5)),
            color: 'var(--text-muted)', fontWeight: 400 }}>
            空
          </span>
        )}
        {mcp.filter(m => m.hasSecrets).length > 0 && (
          <span style={{ fontSize: 8, color: 'var(--text-muted)' }}>
            {mcp.filter(m => m.hasSecrets).length} 🔑
          </span>
        )}
      </div>

      {/* Satellites */}
      {mcp.map((m, i) => {
        const a = satAngle(i);
        const halfW = planetRadius + orbitRadius + 10;
        const orbitDist = planetRadius + orbitRadius;
        const sx = halfW + Math.cos(a) * orbitDist;
        const sy = halfW + Math.sin(a) * orbitDist;
        return (
          <div key={m.id} style={{
            position: 'absolute', left: sx, top: sy,
            transform: 'translate(-50%,-50%) scale(1)',
            zIndex: 3,
            animation: `satelliteLand 0.4s cubic-bezier(0.34,1.56,0.64,1) both`,
          }}>
            <div style={{ position: 'relative', display: 'inline-block', cursor:'default' }}>
              <div onClick={(e) => { e.stopPropagation(); data.onUnassignMcp?.(data.path, m.id); }}
                style={{
                  position: 'absolute', top: -6, right: -6, width: 16, height: 16, borderRadius: '50%',
                  background: 'var(--bg-surface)', border: '1px solid var(--border)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 10, color: 'var(--text-muted)', cursor: 'pointer',
                  opacity: 0, transition: 'opacity 0.2s ease',
                  zIndex: 5,
                }}
                className="satellite-x"
              >×</div>
              <McpSatellite label={m.id} hasSecrets={m.hasSecrets} status={m.status} />
            </div>
          </div>
        );
      })}

      {/* Snap preview — 拖拽悬停时显示将要装配的能力 */}
      {isDragOver && draggedItemLabel && (
        <div style={{
          position: 'absolute', left: '50%', top: '50%',
          transform: `translate(-50%,-50%) translateY(-${planetRadius + orbitRadius - 6}px)`,
          zIndex: 4, pointerEvents: 'none', opacity: .85, display: 'flex', alignItems: 'center', gap: 4,
        }}>
          <span style={{ fontSize: 10, padding: '2px 6px', borderRadius: 6,
            background: 'var(--glass-surface-strong)', border: '1px solid var(--glass-border)',
            color: 'var(--text-primary)' }}>
            {draggedItemLabel}
          </span>
          <span style={{ fontSize: 10, color: 'var(--state-pending)' }}>+</span>
        </div>
      )}
    </div>
  );
}
