import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import type { LibraryMcp, LibrarySkill, LibraryPlugin, LibrarySnippet, LibraryBundle } from '../../main/station/types';
import { RubberScroll } from '../theme/RubberScroll';
import { springSnappy, springSmooth } from '../theme/springs';

const BAR: Record<string, string> = { mcp: '#D97757', skill: '#5B7553', plugin: '#C2965A', snippet: '#7B8DB5', bundle: '#9B6B9E' };

function BundleChip({ bundle, onDragStart, onDragEnd, onEditMcp, expanded, onToggle }: {
  bundle: LibraryBundle;
  onDragStart?: (kind: string, id: string) => void;
  onDragEnd?: () => void;
  onEditMcp?: (id: string) => void;
  expanded?: boolean;
  onToggle?: () => void;
}) {
  const count = bundle.mcp.length + bundle.skills.length + bundle.plugins.length;
  return (
    <div style={{ marginBottom: 6 }}>
      <div
        draggable
        onDragStart={e => {
          e.dataTransfer.setData('application/x-station-bundle', JSON.stringify({ kind: 'bundle', id: bundle.id }));
          e.dataTransfer.effectAllowed = 'copy';
          onDragStart?.('bundle', bundle.id);
        }}
        onDragEnd={() => onDragEnd?.()}
      >
        <motion.div
          whileHover={{ x: 2 }}
          whileTap={{ scale: 0.96 }}
          transition={springSnappy}
          onClick={e => { e.stopPropagation(); onToggle?.(); }}
          style={{
            display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer',
            padding: '6px 10px', borderRadius: 8,
            background: 'var(--glass-surface)', border: '1px solid var(--glass-border)', fontSize: 12,
            backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)',
          }}>
          <span style={{ width: 3, height: 14, borderRadius: 2, background: BAR.bundle }} />
          <motion.span animate={{ rotate: expanded ? 90 : 0 }} transition={springSnappy} style={{ fontSize: 10, display: 'inline-block' }}>▶</motion.span>
          <span>{bundle.icon ?? '📦'}</span>
          <span style={{ flex: 1 }}>{bundle.name}</span>
          <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>{count}</span>
        </motion.div>
      </div>
      {/* 展开内部组件 */}
      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={springSmooth}
            style={{ overflow: 'hidden', paddingLeft: 14 }}>
            {bundle.mcp.map(mcpId => (
              <div key={`mcp:${mcpId}`} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '3px 8px 3px 0', fontSize: 11 }}>
                <span style={{ width: 3, height: 10, borderRadius: 2, background: BAR.mcp, flexShrink: 0 }} />
                <span style={{ flex: 1, color: 'var(--text-primary)' }}>{mcpId}</span>
                <span onClick={e => { e.stopPropagation(); e.preventDefault(); onEditMcp?.(mcpId); }}
                  title="配置环境变量"
                  style={{ cursor: 'pointer', opacity: .5, fontSize: 12, userSelect: 'none' }}>🔑</span>
              </div>
            ))}
            {bundle.skills.map(skillId => (
              <div key={`skill:${skillId}`} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '3px 8px 3px 0', fontSize: 11 }}>
                <span style={{ width: 3, height: 10, borderRadius: 2, background: BAR.skill, flexShrink: 0 }} />
                <span style={{ flex: 1, color: 'var(--text-muted)' }}>{skillId}</span>
              </div>
            ))}
            {bundle.plugins.map(pluginId => (
              <div key={`plugin:${pluginId}`} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '3px 8px 3px 0', fontSize: 11 }}>
                <span style={{ width: 3, height: 10, borderRadius: 2, background: BAR.plugin, flexShrink: 0 }} />
                <span style={{ flex: 1, color: 'var(--text-muted)' }}>{pluginId}</span>
              </div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function Chip({ id, kind, hasSecret, onDragStart, onDragEnd, onEditMcp }: {
  id: string; kind: string; hasSecret?: boolean;
  onDragStart?: (kind: string, id: string) => void;
  onDragEnd?: () => void;
  onEditMcp?: (id: string) => void;
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
      style={{ marginBottom: 6 }}
    >
      <motion.div
        whileHover={{ x: 2 }}
        whileTap={{ scale: 0.96 }}
        transition={springSnappy}
        style={{
          display: 'flex', alignItems: 'center', gap: 6, cursor: 'grab',
          padding: '6px 10px', borderRadius: 8,
          background: 'var(--glass-surface)', border: '1px solid var(--glass-border)', fontSize: 12,
          backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)',
        }}>
        <span style={{ width: 3, height: 14, borderRadius: 2, background: BAR[kind] ?? '#999' }} />
        {id}
        {kind === 'mcp' && (
          <span
            onClick={e => { e.stopPropagation(); e.preventDefault(); onEditMcp?.(id); }}
            title={hasSecret ? '编辑密钥' : '配置环境变量'}
            style={{ marginLeft: 'auto', cursor: 'pointer', opacity: hasSecret ? 1 : 0.35, fontSize: 13, userSelect: 'none' }}
          >🔑</span>
        )}
      </motion.div>
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
        <motion.span animate={{ rotate: open ? 90 : 0 }} transition={springSnappy} style={{ fontSize: 10, display: 'inline-block' }}>▶</motion.span>
        {title}
      </div>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={springSmooth}
            style={{ overflow: 'hidden' }}>
            {empty ? <div style={{ fontSize: 12, color: 'var(--text-muted)', paddingLeft: 14 }}>—</div> : children}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export function LibraryRail({ mcp, skills, plugins, snippets, bundles, onDragStartItem, onDragEndItem, onEditMcp }: {
  mcp: LibraryMcp[];
  skills: LibrarySkill[];
  plugins: LibraryPlugin[];
  snippets: LibrarySnippet[];
  bundles: LibraryBundle[];
  onDragStartItem?: (kind: string, id: string) => void;
  onDragEndItem?: () => void;
  onEditMcp?: (id: string) => void;
}) {
  const total = mcp.length + skills.length + plugins.length + snippets.length;
  const bundleIds = new Set(bundles.flatMap(b => [...b.mcp, ...b.skills, ...b.plugins]));
  const [expandedBundles, setExpandedBundles] = useState<Set<string>>(new Set());
  return (
    <aside style={{ width: 200, background: 'var(--bg-rail)', borderRight: '1px solid var(--border)', overflow: 'hidden' }}>
      <RubberScroll style={{ height: '100%', overflowY: 'auto', padding: 16 }}>
        <div className="serif" style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>
          能力库 {total > 0 && <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 400 }}>({total})</span>}
        </div>

        {bundles.length > 0 && (
          <Section title={`Bundles (${bundles.length})`} empty={false}>
            {bundles.map(b => {
              const isExpanded = expandedBundles.has(b.id);
              return <BundleChip key={b.id} bundle={b} onDragStart={onDragStartItem} onDragEnd={onDragEndItem} onEditMcp={onEditMcp}
                expanded={isExpanded}
                onToggle={() => {
                  setExpandedBundles(prev => {
                    const next = new Set(prev);
                    if (next.has(b.id)) next.delete(b.id); else next.add(b.id);
                    return next;
                  });
                }}
              />;
            })}
          </Section>
        )}

        <Section title={`MCP 服务器 (${mcp.length})`} empty={mcp.length === 0}>
          {mcp.map(m => (bundleIds.has(m.id) ? null : <Chip key={m.id} id={m.id} kind="mcp" hasSecret={m.hasSecrets} onDragStart={onDragStartItem} onDragEnd={onDragEndItem} onEditMcp={onEditMcp} />))}
        </Section>

        <Section title={`Skills (${skills.length})`} empty={skills.length === 0} defaultOpen={skills.length > 0}>
          {skills.map(s => (bundleIds.has(s.id) ? null : <Chip key={s.id} id={s.id} kind="skill" onDragStart={onDragStartItem} onDragEnd={onDragEndItem} />))}
        </Section>

        <Section title={`Plugins (${plugins.length})`} empty={plugins.length === 0} defaultOpen={plugins.length > 0}>
          {plugins.map(p => (bundleIds.has(p.id) ? null : <Chip key={p.id} id={p.id} kind="plugin" onDragStart={onDragStartItem} onDragEnd={onDragEndItem} />))}
        </Section>

        <Section title={`配置片段 (${snippets.length})`} empty={snippets.length === 0} defaultOpen={snippets.length > 0}>
          {snippets.map(s => <Chip key={s.id} id={s.id} kind="snippet" onDragStart={onDragStartItem} onDragEnd={onDragEndItem} />)}
        </Section>
      </RubberScroll>
    </aside>
  );
}
