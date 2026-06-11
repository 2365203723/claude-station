import React, { useMemo, useEffect, useState, useCallback } from 'react';
import ReactFlow, { Background, BackgroundVariant, Controls, useNodesState } from 'reactflow';
import 'reactflow/dist/style.css';
import { ProjectPlanet } from './ProjectPlanet';
import { computeOrbitLayout } from './orbitLayout';
import type { ProjectState } from '../../main/types';
import type { LibraryMcp, LibrarySkill, LibraryPlugin, LibrarySnippet, LibraryBundle } from '../../main/station/types';
import type { McpStatus } from './McpSatellite';

const nodeTypes = { planet: ProjectPlanet };

function statusOf(mcpId: string, project: ProjectState, assignedIds: string[], landedIds: Set<string>): McpStatus {
  if (!assignedIds.includes(mcpId)) return 'global';
  if (landedIds.has(mcpId)) return 'applied';
  return 'pending';
}

export interface DragItem { kind: string; id: string; }

interface AssignmentSnapshot {
  mcp: string[];
  skills: string[];
  plugins: string[];
  snippets: string[];
  bundles: string[];
}

export interface GlobalSnapshot {
  mcp: { id: string; hasSecrets: boolean }[];
  skills: string[];
  plugins: string[];
  bundles: LibraryBundle[];
}

export function Canvas({ projects, desiredMcp, desiredSkills, desiredPlugins, desiredSnippets, desiredBundles, lastApplied, onSelect, onDropItem, onUnassignMcp, onUnassignBundle, draggingItem, pendingAssignments, globalSnapshot, onDropGlobal, onUnassignGlobalMcp, onUnassignGlobalSkill, onUnassignGlobalPlugin, onUnassignGlobalBundle, onAddProject, onDeleteProject }: {
  projects: ProjectState[];
  desiredMcp: Record<string, LibraryMcp>;
  desiredSkills: Record<string, LibrarySkill>;
  desiredPlugins: Record<string, LibraryPlugin>;
  desiredSnippets: Record<string, LibrarySnippet>;
  desiredBundles: Record<string, LibraryBundle>;
  lastApplied: Record<string, { mcpJson: Record<string,any>; localScope: Record<string,any> }>;
  onSelect: (p: ProjectState | null) => void;
  onDropItem?: (path: string, kind: string, id: string) => void;
  onUnassignMcp?: (path: string, mcpId: string) => void;
  onUnassignBundle?: (path: string, bundleId: string) => void;
  draggingItem: DragItem | null;
  pendingAssignments?: Record<string, AssignmentSnapshot>;
  globalSnapshot: GlobalSnapshot;
  onDropGlobal?: (kind: string, id: string) => Promise<void>;
  onUnassignGlobalMcp?: (mcpId: string) => void;
  onUnassignGlobalSkill?: (skillId: string) => void;
  onUnassignGlobalPlugin?: (pluginId: string) => void;
  onUnassignGlobalBundle?: (bundleId: string) => void;
  onAddProject?: () => void;
  onDeleteProject?: (path: string, name: string) => void;
}) {
  // Layout: projects + synthetic Global node
  const layout = useMemo(() => {
    const assignments = pendingAssignments ?? {};
    const inputs = projects.map(p => {
      const existing = p.mcp.length;
      const pending = (assignments[p.path]?.mcp ?? []).filter(id => !p.mcp.some(m => m.id === id)).length;
      const bundleCount = (assignments[p.path]?.bundles ?? []).length;
      return { path: p.path, mcpCount: existing + pending + bundleCount };
    });
    // Global planet always last
    const globalCount = globalSnapshot.mcp.length + globalSnapshot.bundles.length;
    inputs.push({ path: '__global__', mcpCount: globalCount });
    const positions = computeOrbitLayout(inputs);
    return positions;
  }, [projects, pendingAssignments, globalSnapshot]);

  const computedNodes = useMemo(() => {
    const assignments = pendingAssignments ?? {};
    return layout.map(l => {
    if (l.path === '__global__') {
      // Synthetic global planet
      return {
        id: '__global__',
        type: 'planet' as const,
        position: { x: l.x - l.safeRadius, y: l.y - l.safeRadius },
        data: {
          ...l,
          name: '🌐 Global',
          path: '__global__',
          isGlobal: true,
          mcp: globalSnapshot.mcp.map(m => ({ id: m.id, hasSecrets: m.hasSecrets, status: 'applied' as McpStatus })),
          skills: globalSnapshot.skills,
          plugins: globalSnapshot.plugins,
          snippets: [],
          bundles: globalSnapshot.bundles,
          libraryMcp: desiredMcp,
          librarySkills: desiredSkills,
          libraryPlugins: desiredPlugins,
          librarySnippets: desiredSnippets,
          draggingItem,
          isDragOver: draggingItem !== null,
          onDropItem: (path: string, kind: string, id: string) => onDropGlobal?.(kind, id),
          onUnassignMcp: (_path: string, mcpId: string) => onUnassignGlobalMcp?.(mcpId),
          onUnassignSkill: (_path: string, skillId: string) => onUnassignGlobalSkill?.(skillId),
          onUnassignPlugin: (_path: string, pluginId: string) => onUnassignGlobalPlugin?.(pluginId),
          onUnassignBundle: (_path: string, bundleId: string) => onUnassignGlobalBundle?.(bundleId),
          onSelect: () => onSelect(null), // selecting global clears project panel
        },
      };
    }

    const p = projects.find(x => x.path === l.path)!;
    const a = assignments[l.path] ?? { mcp: [], skills: [], plugins: [], snippets: [], bundles: [] };

    const inferredMcp = p.mcp.map(m => m.id);
    const pendingMcp = a.mcp.filter(id => !inferredMcp.includes(id));
    const allMCP = [...p.mcp.map(m => ({ id: m.id, hasSecrets: m.hasSecrets, status: statusOf(m.id, p, a.mcp, new Set()) })), ...pendingMcp.map(id => ({ id, hasSecrets: desiredMcp[id]?.hasSecrets ?? false, status: 'pending' as McpStatus }))];

    const applied = lastApplied[l.path];
    const landedIds = new Set<string>([...Object.keys(applied?.mcpJson ?? {}), ...Object.keys(applied?.localScope ?? {})]);

    const bundledMcpIds = new Set<string>();
    const bundledSkillIds = new Set<string>();
    const bundledPluginIds = new Set<string>();
    for (const bid of a.bundles) {
      const b = desiredBundles[bid];
      if (b) { b.mcp.forEach(id => bundledMcpIds.add(id)); b.skills.forEach(id => bundledSkillIds.add(id)); b.plugins.forEach(id => bundledPluginIds.add(id)); }
    }

    const mcpWithStatus = allMCP.filter(m => !bundledMcpIds.has(m.id)).map(m => ({
      ...m, status: !a.mcp.includes(m.id) ? 'global' as McpStatus : landedIds.has(m.id) ? 'applied' as McpStatus : 'pending' as McpStatus,
    }));

    const inferredSkills = p.skills.filter(s => !bundledSkillIds.has(s.id)).map(s => s.id);
    const pendingSkills = a.skills.filter(id => !inferredSkills.includes(id) && !bundledSkillIds.has(id));
    const allSkills = [...inferredSkills, ...pendingSkills];

    const inferredPlugins = p.plugins.filter(pl => pl.enabled && !bundledPluginIds.has(pl.id)).map(pl => pl.id);
    const pendingPlugins = a.plugins.filter(id => !inferredPlugins.includes(id) && !bundledPluginIds.has(id));
    const allPlugins = [...inferredPlugins, ...pendingPlugins];

    const allSnippets = a.snippets;
    const assignedBundles = (a.bundles ?? []).map(bid => desiredBundles[bid]).filter(Boolean) as LibraryBundle[];

    return { id: l.path, type: 'planet' as const, position: { x: l.x - l.safeRadius, y: l.y - l.safeRadius },
      data: { ...l, name: l.path.split('/').pop() || l.path, mcp: mcpWithStatus, skills: allSkills, plugins: allPlugins, snippets: allSnippets, bundles: assignedBundles,
        libraryMcp: desiredMcp, librarySkills: desiredSkills, libraryPlugins: desiredPlugins, librarySnippets: desiredSnippets,
        draggingItem, isDragOver: draggingItem !== null, onDropItem, onUnassignMcp, onUnassignBundle, onSelect: () => onSelect(p) },
    };
  })}, [layout, projects, lastApplied, desiredMcp, desiredSkills, desiredPlugins, desiredSnippets, desiredBundles, pendingAssignments, globalSnapshot, draggingItem, onDropItem, onUnassignMcp, onUnassignBundle, onSelect, onDropGlobal, onUnassignGlobalMcp, onUnassignGlobalSkill, onUnassignGlobalPlugin, onUnassignGlobalBundle]);

  const [nodes, setNodes, onNodesChange] = useNodesState(computedNodes);
  const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number; planetPath?: string; planetName?: string; isGlobal?: boolean } | null>(null);

  const onPaneCtx = useCallback((e: React.MouseEvent | MouseEvent) => {
    e.preventDefault();
    setCtxMenu({ x: (e as React.MouseEvent).clientX, y: (e as React.MouseEvent).clientY });
  }, []);

  const onNodeCtx = useCallback((_e: any, node: any) => {
    const e = _e as React.MouseEvent; e.preventDefault();
    const name = node.data?.name ?? '';
    const isGlobal = node.data?.isGlobal ?? false;
    setCtxMenu({ x: e.clientX, y: e.clientY, planetPath: node.data?.path, planetName: name, isGlobal });
  }, []);

  useEffect(() => { const close = () => setCtxMenu(null); document.addEventListener('click', close); return () => document.removeEventListener('click', close); }, []);

  useEffect(() => { setNodes(current => { const prevById = new Map(current.map(n => [n.id, n])); return computedNodes.map(c => { const prev = prevById.get(c.id); return prev ? { ...c, position: prev.position } : c; }); }); }, [computedNodes, setNodes]);

  return (
    <div style={{ flex: 1, height: '100%' }}>
      <ReactFlow nodes={nodes} edges={[]} nodeTypes={nodeTypes} onNodesChange={onNodesChange}
        onNodeClick={(_, n) => n.data?.onSelect?.()} onNodeContextMenu={onNodeCtx} onPaneContextMenu={onPaneCtx}
        nodesDraggable fitView>
        <Background variant={BackgroundVariant.Dots} gap={28} size={1.2} color="var(--orbit-line)" style={{ opacity: .35 }} />
        <Controls />
      </ReactFlow>
      {ctxMenu && (
        <div onClick={(e) => e.stopPropagation()} style={{ position: 'absolute', left: ctxMenu.x, top: ctxMenu.y, zIndex: 100, background: 'var(--glass-surface-strong)', backdropFilter: 'blur(20px) saturate(180%)', WebkitBackdropFilter: 'blur(20px) saturate(180%)', border: '1px solid var(--glass-border)', borderRadius: 14, padding: 8, boxShadow: 'var(--glass-shadow)', minWidth: 180 }}>
          {ctxMenu.planetPath && !ctxMenu.isGlobal ? (
            <><div style={{ fontSize: 11, color: 'var(--text-muted)', padding: '4px 10px', marginBottom: 4 }}>{ctxMenu.planetName}</div>
              <button onClick={() => { onDeleteProject?.(ctxMenu.planetPath!, ctxMenu.planetName!); setCtxMenu(null); }} style={ctxBtnStyle}>🔌 删除项目…</button></>
          ) : (
            <button onClick={() => { onAddProject?.(); setCtxMenu(null); }} style={ctxBtnStyle}>🆕 添加项目</button>
          )}
        </div>
      )}
    </div>
  );
}

const ctxBtnStyle: React.CSSProperties = { display: 'block', width: '100%', padding: '6px 10px', border: 'none', borderRadius: 8, background: 'transparent', color: 'var(--text-primary)', cursor: 'pointer', fontSize: 12, textAlign: 'left' as const };
