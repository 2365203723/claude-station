import React from 'react';
import { motion } from 'motion/react';
import type { ProjectState } from '../../main/types';
import type { LibraryBundle, LibraryMcp } from '../../main/station/types';
import type { GlobalSnapshot } from '../canvas/Canvas';
import { springSmooth } from '../theme/springs';
import { RubberScroll } from '../theme/RubberScroll';

interface AssignmentData {
  mcp: string[]; skills: string[]; plugins: string[]; snippets: string[]; bundles: string[];
}

export function DetailPanel({ project, assignments, desiredBundles, desiredMcp, onUnassign, onUnassignBundle, onDeleteProject, isGlobal, globalSnapshot, onUnassignGlobalMcp, onUnassignGlobalSkill, onUnassignGlobalPlugin, onUnassignGlobalBundle }: {
  project: ProjectState | null;
  assignments?: AssignmentData;
  desiredBundles: Record<string, LibraryBundle>;
  desiredMcp: Record<string, LibraryMcp>;
  onUnassign?: (kind: string, id: string) => void;
  onUnassignBundle?: (bundleId: string) => void;
  onDeleteProject?: (path: string, name: string) => void;
  isGlobal?: boolean;
  globalSnapshot?: GlobalSnapshot;
  onUnassignGlobalMcp?: (mcpId: string) => void;
  onUnassignGlobalSkill?: (skillId: string) => void;
  onUnassignGlobalPlugin?: (pluginId: string) => void;
  onUnassignGlobalBundle?: (bundleId: string) => void;
}) {
  // Global panel
  if (isGlobal && globalSnapshot) {
    const gs = globalSnapshot;
    const globalMcp = gs.mcp.map(m => ({ id: m.id, status: 'applied' as const }));
    const globalSkills = gs.skills.map(s => ({ id: s, status: 'applied' as const }));
    const globalPlugins = gs.plugins.map(p => ({ id: p, status: 'applied' as const }));
    const globalBundles = gs.bundles;

    return (
      <motion.aside
        key="__global__"
        initial={{ x: 24, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        transition={springSmooth}
        style={{ ...panelStyle, padding: 0, overflow: 'hidden' }}
      >
        <RubberScroll style={{ height: '100%', overflowY: 'auto', padding: 20 }}>
          <h2 className="serif" style={{ fontSize: 18, marginTop: 0 }}>🌐 Global</h2>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 8 }}>~/.claude.json · ~/.claude/skills/ · settings.json</div>

          {globalBundles.length > 0 && (
            <div style={{ marginTop: 16 }}>
              <div className="serif" style={{ fontSize: 13, fontWeight: 600, marginBottom: 6 }}>Bundles ({globalBundles.length})</div>
              {globalBundles.map(b => (
                <div key={b.id} style={{ marginBottom: 10 }}>
                  <div style={{ fontSize: 12, padding: '2px 0', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#9B6B9E', flexShrink: 0 }} />
                    <span style={{ flex: 1, fontWeight: 600 }}>{b.icon ?? '📦'} {b.name}</span>
                    {onUnassignGlobalBundle && <span onClick={() => onUnassignGlobalBundle(b.id)} style={{ cursor: 'pointer', color: 'var(--text-muted)', fontSize: 14, opacity: .5 }}>×</span>}
                  </div>
                  {[...b.mcp.map(id => ({ id, kind: 'MCP', hasSecrets: desiredMcp[id]?.hasSecrets ?? false })), ...b.skills.map(id => ({ id, kind: 'Skill', hasSecrets: false })), ...b.plugins.map(id => ({ id, kind: 'Plugin', hasSecrets: false }))].map(item => (
                    <div key={`${b.id}:${item.id}`} style={{ fontSize: 11, padding: '1px 0 1px 18px', display: 'flex', alignItems: 'center', gap: 6, color: 'var(--text-muted)', opacity: .65 }}>
                      <span style={{ width: 4, height: 4, borderRadius: '50%', background: item.kind === 'MCP' ? '#D97757' : item.kind === 'Skill' ? '#5B7553' : '#C2965A', flexShrink: 0 }} />
                      <span style={{ flex: 1 }}>{item.id}{item.hasSecrets ? ' 🔑' : ''}</span>
                      <span style={{ fontSize: 9, opacity: .5 }}>🔒</span>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          )}

          <Group title={`MCP (${globalMcp.length})`} items={globalMcp.map(m => m.id)} statuses={globalMcp.map(() => 'applied')} onRemove={onUnassignGlobalMcp ? (id: string) => onUnassignGlobalMcp(id) : undefined} />
          <Group title={`Skills (${globalSkills.length})`} items={globalSkills.map(s => s.id)} statuses={globalSkills.map(() => 'applied')} onRemove={onUnassignGlobalSkill ? (id: string) => onUnassignGlobalSkill(id) : undefined} />
          <Group title={`Plugins (${globalPlugins.length})`} items={globalPlugins.map(p => p.id)} statuses={globalPlugins.map(() => 'applied')} onRemove={onUnassignGlobalPlugin ? (id: string) => onUnassignGlobalPlugin(id) : undefined} />
        </RubberScroll>
      </motion.aside>
    );
  }

  if (!project) {
    return (
      <aside style={panelStyle}>
        <p style={{ color: 'var(--text-muted)' }}>点击一个项目查看它挂了哪些能力</p>
      </aside>
    );
  }

  const a = assignments ?? { mcp: [], skills: [], plugins: [], snippets: [], bundles: [] };

  // 收集 bundle 覆盖的个体 ID（隐藏它们，不可单独删除）
  const bundledMcpIds = new Set<string>();
  const bundledSkillIds = new Set<string>();
  const bundledPluginIds = new Set<string>();
  const assignedBundles: LibraryBundle[] = [];
  for (const bid of a.bundles) {
    const b = desiredBundles[bid];
    if (b) {
      assignedBundles.push(b);
      b.mcp.forEach(id => bundledMcpIds.add(id));
      b.skills.forEach(id => bundledSkillIds.add(id));
      b.plugins.forEach(id => bundledPluginIds.add(id));
    }
  }

  // 合并 inferred + pending (排除被 bundle 覆盖的)
  const inferredMcp = new Set(project.mcp.map(m => m.id));
  const allMcp = [...project.mcp.filter(m => !bundledMcpIds.has(m.id)).map(m => ({ id: m.id, hasSecrets: m.hasSecrets, status: 'applied' as const })), ...a.mcp.filter(id => !inferredMcp.has(id) && !bundledMcpIds.has(id)).map(id => ({ id, hasSecrets: false, status: 'pending' as const }))];

  const inferredSkills = new Set(project.skills.map(s => s.id));
  const allSkills = [...project.skills.filter(s => !bundledSkillIds.has(s.id)).map(s => ({ id: s.id, status: 'applied' as const })), ...a.skills.filter(id => !inferredSkills.has(id) && !bundledSkillIds.has(id)).map(id => ({ id, status: 'pending' as const }))];

  const inferredPlugins = new Set(project.plugins.filter(p => p.enabled).map(p => p.id));
  const allPlugins = [...project.plugins.filter(p => p.enabled && !bundledPluginIds.has(p.id)).map(p => ({ id: p.id, status: 'applied' as const })), ...a.plugins.filter(id => !inferredPlugins.has(id) && !bundledPluginIds.has(id)).map(id => ({ id, status: 'pending' as const }))];

  const allSnippets = a.snippets.map(id => ({ id, status: 'pending' as const }));

  return (
    <motion.aside
      key={project.path}
      initial={{ x: 24, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      transition={springSmooth}
      style={{ ...panelStyle, padding: 0, overflow: 'hidden' }}
    >
      <RubberScroll style={{ height: '100%', overflowY: 'auto', padding: 20 }}>
        <h2 className="serif" style={{ fontSize: 18, marginTop: 0 }}>
          {project.path.split('/').pop()}
        </h2>
        <div style={{ fontSize: 11, color: 'var(--text-muted)', wordBreak: 'break-all', marginBottom: 8 }}>{project.path}</div>
        {onDeleteProject && (
          <motion.button whileTap={{ scale: .96 }} transition={{ type: 'spring', stiffness: 500, damping: 30, mass: .8 }}
            onClick={() => onDeleteProject(project.path, project.path.split('/').pop() || project.path)}
            style={{ marginBottom: 12, padding: '4px 10px', borderRadius: 8, border: '1px solid var(--state-drift)', background: 'var(--bg-canvas)', color: 'var(--state-drift)', cursor: 'pointer', fontSize: 11 }}>
            删除项目…
          </motion.button>
        )}

        {assignedBundles.length > 0 && (
          <div style={{ marginTop: 16 }}>
            <div className="serif" style={{ fontSize: 13, fontWeight: 600, marginBottom: 6 }}>
              Bundles ({assignedBundles.length})
            </div>
            {assignedBundles.map(b => (
              <div key={b.id} style={{ marginBottom: 10 }}>
                {/* Bundle header — 可删除 */}
                <div style={{ fontSize: 12, padding: '2px 0', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#9B6B9E', flexShrink: 0 }} />
                  <span style={{ flex: 1, fontWeight: 600 }}>{b.icon ?? '📦'} {b.name}</span>
                  {onUnassignBundle && (
                    <span onClick={() => onUnassignBundle(b.id)}
                      style={{ cursor: 'pointer', color: 'var(--text-muted)', fontSize: 14, opacity: .5, lineHeight: 1 }}
                      title="移除 Bundle">×</span>
                  )}
                </div>
                {/* Bundle 内组件 — 灰色，不可删除，MCP 显示 🔑 标记 */}
                {[...b.mcp.map(id => ({ id, kind: 'MCP', hasSecrets: desiredMcp[id]?.hasSecrets ?? false })), ...b.skills.map(id => ({ id, kind: 'Skill', hasSecrets: false })), ...b.plugins.map(id => ({ id, kind: 'Plugin', hasSecrets: false }))].map(item => (
                  <div key={`${b.id}:${item.id}`} style={{ fontSize: 11, padding: '1px 0 1px 18px', display: 'flex', alignItems: 'center', gap: 6, color: 'var(--text-muted)', opacity: .65 }}>
                    <span style={{ width: 4, height: 4, borderRadius: '50%', background: item.kind === 'MCP' ? '#D97757' : item.kind === 'Skill' ? '#5B7553' : '#C2965A', flexShrink: 0 }} />
                    <span style={{ flex: 1 }}>{item.id}{item.hasSecrets ? ' 🔑' : ''}</span>
                    <span style={{ fontSize: 9, opacity: .5 }} title="由 Bundle 管理">🔒</span>
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}

        <Group title={`MCP (${allMcp.length})`} items={allMcp.map(m => m.id + (m.hasSecrets ? ' 🔑' : ''))} statuses={allMcp.map(m => m.status)} onRemove={onUnassign ? (id: string) => onUnassign('mcp', id) : undefined} />
        <Group title={`Skills (${allSkills.length})`} items={allSkills.map(s => s.id)} statuses={allSkills.map(s => s.status)} onRemove={onUnassign ? (id: string) => onUnassign('skill', id) : undefined} />
        <Group title={`Plugins (${allPlugins.length})`} items={allPlugins.map(p => p.id)} statuses={allPlugins.map(p => p.status)} onRemove={onUnassign ? (id: string) => onUnassign('plugin', id) : undefined} />
        {allSnippets.length > 0 && (
          <Group title={`配置片段 (${allSnippets.length})`} items={allSnippets.map(s => s.id)} statuses={allSnippets.map(s => s.status)} onRemove={onUnassign ? (id: string) => onUnassign('snippet', id) : undefined} />
        )}
      </RubberScroll>
    </motion.aside>
  );
}

function Group({ title, items, statuses, onRemove }: {
  title: string; items: string[]; statuses: string[];
  onRemove?: (id: string) => void;
}) {
  return (
    <div style={{ marginTop: 16 }}>
      <div className="serif" style={{ fontSize: 13, fontWeight: 600, marginBottom: 6 }}>{title}</div>
      {items.length === 0
        ? <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>—</div>
        : items.map((label, i) => {
          const status = statuses[i] ?? 'pending';
          return (
            <div key={label} style={{ fontSize: 12, padding: '2px 0', display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: status === 'applied' ? 'var(--state-applied)' : 'var(--state-pending)', flexShrink: 0 }} title={status === 'applied' ? '已应用' : '待应用'} />
              <span style={{ flex: 1 }}>{label}</span>
              {onRemove && (
                <span onClick={(e) => { e.stopPropagation(); onRemove(cleanId(label)); }}
                  style={{ cursor: 'pointer', color: 'var(--text-muted)', fontSize: 14, opacity: .5, lineHeight: 1 }}
                  title="撤销装配"
                >×</span>
              )}
            </div>
          );
        })}
    </div>
  );
}

// 从显示标签中移除 🔑 emoji 得到真实 id
function cleanId(label: string): string {
  return label.replace(/ 🔑$/, '');
}

const panelStyle: React.CSSProperties = {
  width: 300, height: '100%', padding: 20, overflowY: 'auto',
  background: 'var(--bg-surface)', borderLeft: '1px solid var(--border)',
};
