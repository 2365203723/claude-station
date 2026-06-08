import React, { useMemo } from 'react';
import ReactFlow, { Background, BackgroundVariant, Controls } from 'reactflow';
import 'reactflow/dist/style.css';
import { ProjectPlanet } from './ProjectPlanet';
import { computeOrbitLayout } from './orbitLayout';
import type { ProjectState } from '../../main/types';
import type { LibraryMcp } from '../../main/station/types';
import type { McpStatus } from './McpSatellite';

const nodeTypes = { planet: ProjectPlanet };

function statusOf(mcpId: string, project: ProjectState, assignedIds: string[], landedIds: Set<string>): McpStatus {
  if (!assignedIds.includes(mcpId)) return 'global';
  if (landedIds.has(mcpId)) return 'applied';
  return 'pending';
}

export function Canvas({ projects, desiredMcp, lastApplied, onSelect, onDropMcp, draggingMcpId }: {
  projects: ProjectState[];
  desiredMcp: Record<string, LibraryMcp>;
  lastApplied: Record<string, { mcpJson: Record<string,any>; localScope: Record<string,any> }>;
  onSelect: (p: ProjectState) => void;
  onDropMcp?: (path: string, mcpId: string) => void;
  draggingMcpId: string | null;
}) {
  const layout = useMemo(() => {
    const inputs = projects.map(p => ({ path: p.path, mcpCount: p.mcp.length }));
    return computeOrbitLayout(inputs);
  }, [projects]);

  const nodes = useMemo(() => layout.map(l => {
    const p = projects.find(x => x.path === l.path)!;
    const assigned = p.mcp.map(m => m.id);
    const applied = lastApplied[l.path];
    const landedIds = new Set<string>([
      ...Object.keys(applied?.mcpJson ?? {}),
      ...Object.keys(applied?.localScope ?? {}),
    ]);
    return {
      id: l.path,
      type: 'planet',
      position: { x: l.x - l.safeRadius, y: l.y - l.safeRadius },
      data: {
        ...l,
        name: l.path.split('/').pop() || l.path,
        mcp: p.mcp.map(m => ({ id: m.id, hasSecrets: m.hasSecrets, status: statusOf(m.id, p, assigned, landedIds) })),
        libraryMcp: desiredMcp,
        draggingMcpId,
        isDragOver: false,
        onDropMcp,
        onSelect: () => onSelect(p),
      },
    };
  }), [layout, projects, lastApplied, desiredMcp, draggingMcpId, onDropMcp, onSelect]);

  return (
    <div style={{ flex: 1, height: '100%' }}>
      <ReactFlow nodes={nodes} edges={[]} nodeTypes={nodeTypes} fitView>
        <Background
          variant={BackgroundVariant.Dots} gap={28} size={1.2}
          color="var(--orbit-line)"
          style={{ opacity: .35 }}
        />
        <Controls />
      </ReactFlow>
    </div>
  );
}
