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

export function Canvas({ projects, desiredMcp, lastApplied, onSelect, onDropMcp, onUnassignMcp, draggingMcpId, pendingAssignments }: {
  projects: ProjectState[];
  desiredMcp: Record<string, LibraryMcp>;
  lastApplied: Record<string, { mcpJson: Record<string,any>; localScope: Record<string,any> }>;
  onSelect: (p: ProjectState) => void;
  onDropMcp?: (path: string, mcpId: string) => void;
  onUnassignMcp?: (path: string, mcpId: string) => void;
  draggingMcpId: string | null;
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
      draggable: true,
      position: { x: l.x - l.safeRadius, y: l.y - l.safeRadius },
      data: {
        ...l,
        name: l.path.split('/').pop() || l.path,
        mcp: [
          ...p.mcp.map(m => ({ id: m.id, hasSecrets: m.hasSecrets, status: statusOf(m.id, p, assigned, landedIds) })),
          ...pending.map(id => ({ id, hasSecrets: desiredMcp[id]?.hasSecrets ?? false, status: 'pending' as McpStatus })),
        ],
        libraryMcp: desiredMcp,
        draggingMcpId,
        isDragOver: draggingMcpId !== null,
        onDropMcp,
        onUnassignMcp,
        onSelect: () => onSelect(p),
      },
    };
  })}, [layout, projects, lastApplied, desiredMcp, pendingAssignments, draggingMcpId, onDropMcp, onUnassignMcp, onSelect]);

  const [nodes, setNodes, onNodesChange] = useNodesState(computedNodes);

  // 当项目/布局 change 时同步节点(data+位置),但保留用户拖拽后的位置
  useEffect(() => {
    setNodes(current => {
      const byId = new Map(computedNodes.map(n => [n.id, n]));
      return current.map(n => {
        const c = byId.get(n.id);
        if (!c) return n; // 已删除的节点,留着让它自然清理
        return { ...n, data: c.data, position: c.position }; // 覆盖 data,复位位置
      });
    });
  }, [computedNodes, setNodes]);

  return (
    <div style={{ flex: 1, height: '100%' }}>
      <ReactFlow nodes={nodes} edges={[]} nodeTypes={nodeTypes} onNodesChange={onNodesChange} fitView onNodeClick={(_, n) => n.data?.onSelect?.()}>
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
