import React, { useMemo, useEffect } from 'react';
import ReactFlow, { Background, BackgroundVariant, Controls, useNodesState } from 'reactflow';
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

export interface DragItem { kind: string; id: string; }

export function Canvas({ projects, desiredMcp, lastApplied, onSelect, onDropItem, onUnassignMcp, draggingItem, pendingAssignments }: {
  projects: ProjectState[];
  desiredMcp: Record<string, LibraryMcp>;
  lastApplied: Record<string, { mcpJson: Record<string,any>; localScope: Record<string,any> }>;
  onSelect: (p: ProjectState) => void;
  onDropItem?: (path: string, kind: string, id: string) => void;
  onUnassignMcp?: (path: string, mcpId: string) => void;
  draggingItem: DragItem | null;
  pendingAssignments?: Record<string, { mcp: string[] }>;
}) {
  const layout = useMemo(() => {
    const assignments = pendingAssignments ?? {};
    const inputs = projects.map(p => {
      const existing = p.mcp.length;
      const pending = (assignments[p.path]?.mcp ?? []).filter(id => !p.mcp.some(m => m.id === id)).length;
      return { path: p.path, mcpCount: existing + pending };
    });
    return computeOrbitLayout(inputs);
  }, [projects, pendingAssignments]);

  const computedNodes = useMemo(() => {
    const assignments = pendingAssignments ?? {};
    return layout.map(l => {
    const p = projects.find(x => x.path === l.path)!;
    const existing = p.mcp.map(m => m.id);
    const pending = (assignments[l.path]?.mcp ?? []).filter(id => !existing.includes(id));
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
        mcp: [
          ...p.mcp.map(m => ({ id: m.id, hasSecrets: m.hasSecrets, status: statusOf(m.id, p, assigned, landedIds) })),
          ...pending.map(id => ({ id, hasSecrets: desiredMcp[id]?.hasSecrets ?? false, status: 'pending' as McpStatus })),
        ],
        libraryMcp: desiredMcp,
        draggingItem,
        isDragOver: draggingItem !== null,
        onDropItem,
        onUnassignMcp,
        onSelect: () => onSelect(p),
      },
    };
  })}, [layout, projects, lastApplied, desiredMcp, pendingAssignments, draggingItem, onDropItem, onUnassignMcp, onSelect]);

  const [nodes, setNodes, onNodesChange] = useNodesState(computedNodes);

  useEffect(() => {
    setNodes(current => {
      const prevById = new Map(current.map(n => [n.id, n]));
      return computedNodes.map(c => {
        const prev = prevById.get(c.id);
        return prev ? { ...c, position: prev.position } : c;
      });
    });
  }, [computedNodes, setNodes]);

  return (
    <div style={{ flex: 1, height: '100%' }}>
      <ReactFlow
        nodes={nodes}
        edges={[]}
        nodeTypes={nodeTypes}
        onNodesChange={onNodesChange}
        nodesDraggable
        fitView
        onNodeClick={(_, n) => n.data?.onSelect?.()}
      >
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
