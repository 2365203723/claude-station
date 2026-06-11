import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { springSnappy, springSmooth } from '../theme/springs';

export function GlobalSettingsModal({ onClose }: { onClose: () => void }) {
  const [tab, setTab] = useState<'mcp' | 'skills' | 'plugins'>('mcp');
  const [reloadKey, setReloadKey] = useState(0);

  return (
    <motion.div
      onClick={onClose}
      initial={{ opacity: 0, backdropFilter: 'blur(0px)' }}
      animate={{ opacity: 1, backdropFilter: 'blur(8px)' }}
      exit={{ opacity: 0, backdropFilter: 'blur(0px)' }}
      transition={{ duration: 0.2, ease: 'easeOut' }}
      style={{ position: 'fixed', inset: 0, background: 'rgba(40,36,33,.28)', display: 'grid', placeItems: 'center', zIndex: 70 }}
    >
      <motion.div
        onClick={e => e.stopPropagation()}
        initial={{ scale: 0.92, opacity: 0, y: 8 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.96, opacity: 0, y: 4 }}
        transition={springSmooth}
        style={{
          width: 560, maxHeight: '70vh', display: 'flex', flexDirection: 'column',
          background: 'var(--glass-surface-strong)', backdropFilter: 'blur(20px) saturate(180%)',
          WebkitBackdropFilter: 'blur(20px) saturate(180%)', border: '1px solid var(--glass-border)',
          borderRadius: 18, padding: 20, boxShadow: 'var(--glass-shadow)',
        }}
      >
        <h2 className="serif" style={{ marginTop: 0, fontSize: 18, marginBottom: 4 }}>全局配置</h2>
        <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 0, marginBottom: 14 }}>
          管理 ~/.claude.json / ~/.claude/skills/ / ~/.claude/settings.json
        </p>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 4, marginBottom: 14 }}>
          {(['mcp', 'skills', 'plugins'] as const).map(t => (
            <motion.button key={t} whileTap={{ scale: .96 }} transition={springSnappy}
              onClick={() => setTab(t)}
              style={{
                padding: '5px 14px', borderRadius: 8, border: '1px solid var(--border)',
                background: tab === t ? 'var(--accent)' : 'var(--bg-canvas)',
                color: tab === t ? '#fff' : 'var(--text-primary)', cursor: 'pointer', fontSize: 12,
              }}>
              {t === 'mcp' ? 'MCP 服务器' : t === 'skills' ? 'Skills' : 'Plugins'}
            </motion.button>
          ))}
        </div>

        <div style={{ overflowY: 'auto', flex: 1 }}>
          {tab === 'mcp' && <GlobalMcpTab key={`mcp-${reloadKey}`} />}
          {tab === 'skills' && <GlobalSkillsTab key={`skills-${reloadKey}`} />}
          {tab === 'plugins' && <GlobalPluginsTab key={`plugins-${reloadKey}`} />}
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 12 }}>
          <motion.button whileTap={{ scale: .96 }} transition={springSnappy}
            onClick={onClose}
            style={{ padding: '6px 14px', borderRadius: 10, border: '1px solid var(--border)', background: 'var(--bg-canvas)', color: 'var(--text-primary)', cursor: 'pointer' }}>
            关闭
          </motion.button>
        </div>
      </motion.div>
    </motion.div>
  );
}

/* ==================== MCP Tab ==================== */
function GlobalMcpTab() {
  const [items, setItems] = useState<{ id: string; def: any }[]>([]);
  const [adding, setAdding] = useState(false);
  const [newId, setNewId] = useState('');
  const [newCmd, setNewCmd] = useState('');
  const [newEnv, setNewEnv] = useState('');

  const load = useCallback(async () => {
    setItems(await window.station.listGlobalMcp());
  }, []);
  useEffect(() => { load(); }, [load]);

  const handleAdd = async () => {
    if (!newId.trim()) return;
    const env: Record<string, string> = {};
    if (newEnv.trim()) {
      newEnv.split(',').forEach(pair => { const [k, v] = pair.split('='); if (k) env[k.trim()] = (v ?? '').trim(); });
    }
    await window.station.addGlobalMcp(newId.trim(), { command: newCmd.trim() || undefined, args: [], env: Object.keys(env).length > 0 ? env : undefined });
    setAdding(false); setNewId(''); setNewCmd(''); setNewEnv('');
    await load();
  };

  return (
    <div>
      {items.map(item => (
        <div key={item.id} style={itemRow}>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}>{item.id}</span>
          <code style={{ fontSize: 10, color: 'var(--text-muted)' }}>{item.def?.command ?? item.def?.url ?? ''}</code>
          <motion.button whileTap={{ scale: .96 }} transition={springSnappy}
            onClick={async () => { await window.station.removeGlobalMcp(item.id); load(); }}
            style={dangerBtn}>×</motion.button>
        </div>
      ))}
      {adding ? (
        <div style={{ ...itemRow, flexDirection: 'column', alignItems: 'stretch', gap: 6 }}>
          <input value={newId} onChange={e => setNewId(e.target.value)} placeholder="MCP ID (如 my-server)" style={inputS} autoFocus />
          <input value={newCmd} onChange={e => setNewCmd(e.target.value)} placeholder="command (如 npx -y my-mcp)" style={inputS} />
          <input value={newEnv} onChange={e => setNewEnv(e.target.value)} placeholder="env (KEY=val,KEY2=val2)" style={inputS} />
          <div style={{ display: 'flex', gap: 6 }}>
            <motion.button whileTap={{ scale: .96 }} transition={springSnappy} onClick={handleAdd} style={priBtn}>添加</motion.button>
            <motion.button whileTap={{ scale: .96 }} transition={springSnappy} onClick={() => setAdding(false)} style={secBtn}>取消</motion.button>
          </div>
        </div>
      ) : (
        <motion.button whileTap={{ scale: .96 }} transition={springSnappy}
          onClick={() => setAdding(true)}
          style={{ ...secBtn, width: '100%', marginTop: 8 }}>+ 添加 MCP</motion.button>
      )}
    </div>
  );
}

/* ==================== Skills Tab ==================== */
function GlobalSkillsTab() {
  const [items, setItems] = useState<{ id: string; isSymlink: boolean }[]>([]);
  const [adding, setAdding] = useState(false);
  const [newId, setNewId] = useState('');
  const [newPath, setNewPath] = useState('');

  const load = useCallback(async () => {
    setItems(await window.station.listGlobalSkills());
  }, []);
  useEffect(() => { load(); }, [load]);

  const handleAdd = async () => {
    if (!newId.trim()) return;
    await window.station.addGlobalSkill(newId.trim(), newPath.trim() || undefined);
    setAdding(false); setNewId(''); setNewPath('');
    load();
  };

  return (
    <div>
      {items.map(item => (
        <div key={item.id} style={itemRow}>
          <span style={{ fontSize: 12 }}>{item.id}</span>
          {item.isSymlink && <span style={{ fontSize: 9, color: 'var(--text-muted)' }}>🔗</span>}
          <motion.button whileTap={{ scale: .96 }} transition={springSnappy}
            onClick={async () => { await window.station.removeGlobalSkill(item.id); load(); }}
            style={dangerBtn}>×</motion.button>
        </div>
      ))}
      {adding ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <input value={newId} onChange={e => setNewId(e.target.value)} placeholder="Skill ID" style={inputS} autoFocus />
          <input value={newPath} onChange={e => setNewPath(e.target.value)} placeholder="源路径 (可选，留空创建空目录)" style={inputS} />
          <div style={{ display: 'flex', gap: 6 }}>
            <motion.button whileTap={{ scale: .96 }} transition={springSnappy} onClick={handleAdd} style={priBtn}>添加</motion.button>
            <motion.button whileTap={{ scale: .96 }} transition={springSnappy} onClick={() => setAdding(false)} style={secBtn}>取消</motion.button>
          </div>
        </div>
      ) : (
        <motion.button whileTap={{ scale: .96 }} transition={springSnappy}
          onClick={() => setAdding(true)}
          style={{ ...secBtn, width: '100%', marginTop: 8 }}>+ 添加 Skill</motion.button>
      )}
    </div>
  );
}

/* ==================== Plugins Tab ==================== */
function GlobalPluginsTab() {
  const [items, setItems] = useState<{ id: string; enabled: boolean }[]>([]);
  const [adding, setAdding] = useState(false);
  const [newId, setNewId] = useState('');

  const load = useCallback(async () => {
    setItems(await window.station.listGlobalPlugins());
  }, []);
  useEffect(() => { load(); }, [load]);

  return (
    <div>
      {items.map(item => (
        <div key={item.id} style={itemRow}>
          <span style={{ fontSize: 12, flex: 1 }}>{item.id}</span>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: item.enabled ? 'var(--state-applied)' : 'var(--text-muted)', flexShrink: 0 }} />
          <motion.button whileTap={{ scale: .96 }} transition={springSnappy}
            onClick={async () => { await window.station.removeGlobalPlugin(item.id); load(); }}
            style={{ ...secBtn, fontSize: 10, padding: '2px 8px' }}>
            {item.enabled ? '禁用' : '启用'}
          </motion.button>
        </div>
      ))}
      {adding ? (
        <div style={{ display: 'flex', gap: 6 }}>
          <input value={newId} onChange={e => setNewId(e.target.value)} placeholder="Plugin ID (如 superpowers@marketplace)" style={{ ...inputS, flex: 1 }} autoFocus />
          <motion.button whileTap={{ scale: .96 }} transition={springSnappy} onClick={async () => {
            if (!newId.trim()) return;
            await window.station.addGlobalPlugin(newId.trim());
            setAdding(false); setNewId(''); load();
          }} style={priBtn}>添加</motion.button>
          <motion.button whileTap={{ scale: .96 }} transition={springSnappy} onClick={() => setAdding(false)} style={secBtn}>取消</motion.button>
        </div>
      ) : (
        <motion.button whileTap={{ scale: .96 }} transition={springSnappy}
          onClick={() => setAdding(true)}
          style={{ ...secBtn, width: '100%', marginTop: 8 }}>+ 添加 Plugin</motion.button>
      )}
    </div>
  );
}

const inputS: React.CSSProperties = { width: '100%', padding: '6px 10px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-canvas)', color: 'var(--text-primary)', fontSize: 12, fontFamily: 'var(--font-mono)' };
const itemRow: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 8, padding: '5px 0', borderBottom: '1px solid var(--border)' };
const secBtn: React.CSSProperties = { padding: '5px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-canvas)', color: 'var(--text-primary)', cursor: 'pointer', fontSize: 12 };
const priBtn: React.CSSProperties = { padding: '5px 12px', borderRadius: 8, border: 'none', background: 'var(--accent)', color: '#fff', cursor: 'pointer', fontSize: 12 };
const dangerBtn: React.CSSProperties = { marginLeft: 'auto', padding: '1px 6px', borderRadius: 6, border: '1px solid var(--state-drift)', background: 'transparent', color: 'var(--state-drift)', cursor: 'pointer', fontSize: 14 };
