import React, { useEffect, useState } from 'react';
import { Canvas } from './canvas/Canvas';
import { DetailPanel } from './panel/DetailPanel';
import type { InferredState, ProjectState } from '../main/types';

export function App() {
  const [state, setState] = useState<InferredState | null>(null);
  const [selected, setSelected] = useState<ProjectState | null>(null);
  const [theme, setTheme] = useState<'light' | 'dark'>('light');

  useEffect(() => { window.station.getState().then(setState); }, []);
  useEffect(() => { document.documentElement.setAttribute('data-theme', theme); }, [theme]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
      <header style={{
        height: 44, display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0 16px', borderBottom: '1px solid var(--border)', background: 'var(--bg-surface)',
        WebkitUserSelect: 'none',
      }}>
        <span className="serif" style={{ fontWeight: 600 }}>Claude Station</span>
        <button onClick={() => setTheme(t => t === 'light' ? 'dark' : 'light')}
          style={{ border: '1px solid var(--border)', borderRadius: 8, padding: '4px 10px',
                   background: 'var(--bg-canvas)', color: 'var(--text-primary)', cursor: 'pointer' }}>
          {theme === 'light' ? '🌙 深色' : '☀️ 浅色'}
        </button>
      </header>
      <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
        <aside style={{ width: 200, background: 'var(--bg-rail)', borderRight: '1px solid var(--border)', padding: 16 }}>
          <div className="serif" style={{ fontSize: 13, color: 'var(--text-muted)' }}>库(M2 启用)</div>
        </aside>
        {state ? <Canvas projects={state.projects} onSelect={setSelected} />
               : <div style={{ flex: 1, display: 'grid', placeItems: 'center', color: 'var(--text-muted)' }}>读取配置中…</div>}
        <DetailPanel project={selected} />
      </div>
    </div>
  );
}
