import React, { useState, useEffect, useCallback } from 'react';
import { motion } from 'motion/react';
import { springSmooth, springSnappy } from '../theme/springs';

interface EnvEditModalProps {
  mcpId: string;
  onClose: () => void;
  onSaved: (desired: any) => void;
}

export function EnvEditModal({ mcpId, onClose, onSaved }: EnvEditModalProps) {
  const [pairs, setPairs] = useState<{ key: string; value: string }[]>([]);
  const [visible, setVisible] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    window.station.getMcpEnv(mcpId).then(data => {
      if (data) {
        setPairs(Object.entries(data.env).map(([k, v]) => ({ key: k, value: v })));
      }
      setLoading(false);
    });
  }, [mcpId]);

  const toggleVisible = useCallback((key: string) => {
    setVisible(prev => { const next = new Set(prev); if (next.has(key)) next.delete(key); else next.add(key); return next; });
  }, []);

  const removeRow = useCallback((idx: number) => {
    setPairs(prev => prev.filter((_, i) => i !== idx));
  }, []);

  const addRow = useCallback(() => {
    setPairs(prev => [...prev, { key: '', value: '' }]);
  }, []);

  const handleKeyChange = useCallback((idx: number, key: string) => {
    setPairs(prev => prev.map((p, i) => i === idx ? { ...p, key } : p));
  }, []);

  const handleValueChange = useCallback((idx: number, value: string) => {
    setPairs(prev => prev.map((p, i) => i === idx ? { ...p, value } : p));
  }, []);

  const handleSave = useCallback(async () => {
    const env: Record<string, string> = {};
    for (const { key, value } of pairs) {
      if (key.trim()) env[key.trim()] = value;
    }
    const next = await window.station.updateMcpEnv(mcpId, env);
    onSaved(next);
    onClose();
  }, [mcpId, pairs, onSaved, onClose]);

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
          width: 500, maxHeight: '70vh', display: 'flex', flexDirection: 'column',
          background: 'var(--glass-surface-strong)', backdropFilter: 'blur(20px) saturate(180%)',
          WebkitBackdropFilter: 'blur(20px) saturate(180%)', border: '1px solid var(--glass-border)',
          borderRadius: 18, padding: 20, boxShadow: 'var(--glass-shadow)',
        }}
      >
        <h2 className="serif" style={{ marginTop: 0, fontSize: 18, marginBottom: 4 }}>
          环境变量 · <span style={{ fontFamily: 'var(--font-mono)', fontSize: 14 }}>{mcpId}</span>
        </h2>
        <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 0, marginBottom: 16 }}>
          这些值会在 apply 时写入项目配置。含有值的变量会自动路由到项目本地作用域,不进入 .mcp.json。
        </p>

        {loading && <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>加载中…</p>}

        {!loading && pairs.length === 0 && (
          <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>暂无环境变量。点击下方按钮添加。</p>
        )}

        <div style={{ overflowY: 'auto', flex: 1, marginRight: -4, paddingRight: 4 }}>
          {pairs.map((pair, i) => (
            <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 8, alignItems: 'center' }}>
              {/* Key name input */}
              <input
                value={pair.key}
                onChange={e => handleKeyChange(i, e.target.value)}
                placeholder="变量名"
                spellCheck={false}
                style={{
                  width: 160, padding: '6px 10px', borderRadius: 8,
                  border: '1px solid var(--border)', background: 'var(--bg-canvas)',
                  color: 'var(--text-primary)', fontSize: 12,
                  fontFamily: 'var(--font-mono)',
                }}
              />
              {/* Value input (masked or not) */}
              <input
                value={pair.value}
                onChange={e => handleValueChange(i, e.target.value)}
                type={visible.has(pair.key || String(i)) ? 'text' : 'password'}
                placeholder="值"
                spellCheck={false}
                style={{
                  flex: 1, padding: '6px 10px', borderRadius: 8,
                  border: '1px solid var(--border)', background: 'var(--bg-canvas)',
                  color: 'var(--text-primary)', fontSize: 12,
                  fontFamily: 'var(--font-mono)',
                }}
              />
              {/* Toggle visibility */}
              <span
                onClick={() => toggleVisible(pair.key || String(i))}
                title={visible.has(pair.key || String(i)) ? '隐藏' : '显示'}
                style={{
                  cursor: 'pointer', fontSize: 14, userSelect: 'none', opacity: 0.6,
                  width: 24, textAlign: 'center',
                }}
              >{visible.has(pair.key || String(i)) ? '🙈' : '👁'}</span>
              {/* Remove row */}
              <span
                onClick={() => removeRow(i)}
                title="移除"
                style={{
                  cursor: 'pointer', fontSize: 16, color: 'var(--text-muted)', opacity: 0.5,
                  width: 20, textAlign: 'center', userSelect: 'none',
                }}
              >×</span>
            </div>
          ))}
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 16 }}>
          <motion.button
            onClick={addRow}
            whileTap={{ scale: 0.96 }}
            transition={springSnappy}
            style={{
              padding: '6px 14px', borderRadius: 10, border: '1px solid var(--border)',
              background: 'var(--bg-canvas)', color: 'var(--text-primary)',
              cursor: 'pointer', fontSize: 12,
            }}
          >+ 添加</motion.button>
          <div style={{ display: 'flex', gap: 8 }}>
            <motion.button
              onClick={onClose}
              whileTap={{ scale: 0.96 }}
              transition={springSnappy}
              style={{
                padding: '6px 14px', borderRadius: 10, border: '1px solid var(--border)',
                background: 'var(--bg-canvas)', color: 'var(--text-primary)',
                cursor: 'pointer',
              }}
            >取消</motion.button>
            <motion.button
              onClick={handleSave}
              whileTap={{ scale: 0.96 }}
              transition={springSnappy}
              style={{
                padding: '6px 14px', borderRadius: 10, border: 'none',
                background: 'var(--accent)', color: '#fff', cursor: 'pointer',
              }}
            >保存</motion.button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}
