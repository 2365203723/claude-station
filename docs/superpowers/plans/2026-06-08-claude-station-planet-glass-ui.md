# Claude Station — M2.6 (Planet Graph Liquid Glass UI) 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把 M1-M2.5 的 MCP 卡片式面板重设计成 graphify 风格的「项目星球 × MCP 卫星」液态玻璃图谱。解决卡片重叠、升级添加体验为拖拽+引力吸附预览。

**Architecture:** renderer-only 重设计。后端(`src/main/station/*`、assign/apply/cleanup IPC)完全不动。新增 `orbitLayout.ts` 纯函数用极坐标防重叠排列项目星球;星球、卫星、轨道、引力场全部内聚在 `ProjectPlanet.tsx` 节点内,MCP capsule 提取为 `McpSatellite.tsx`;`Canvas.tsx` 改用 orbit layout + 管理 drag hover 状态;`LibraryRail.tsx` 视觉升级为玻璃胶囊;`tokens.css` 扩展 liquid glass token。所有配置业务(assign/apply/cleanup)照旧走现有 IPC。

**Tech Stack:** 沿用 Electron + electron-vite + TypeScript;React + React Flow + HTML5 drag;Vitest。无新依赖。

参考 spec:`docs/superpowers/specs/2026-06-08-claude-station-planet-glass-ui.md`。

**复用的现有模块(导入勿重写):**
- `src/main/types.ts`:McpCapability、ProjectState。
- `src/main/station/types.ts`:StationState、LibraryMcp。
- `src/renderer/App.tsx`:assign/apply/cleanup 流程、IPC 调用、`window.station`。
- `src/renderer/panel/DetailPanel.tsx`、`src/renderer/apply/*`:保留不改。

---

## 文件结构

```
src/renderer/
  canvas/
    orbitLayout.ts        # 新:极坐标/螺旋防重叠布局纯函数
    McpSatellite.tsx       # 新:MCP 卫星玻璃胶囊
    ProjectPlanet.tsx      # 新:项目星球节点(替代 ProjectNode)
    Canvas.tsx             # 改:用 orbitLayout + planet node type
    ProjectNode.tsx        # 替换(被 ProjectPlanet 取代)
  rail/
    LibraryRail.tsx        # 改:玻璃胶囊视觉
  theme/
    tokens.css             # 扩展:liquid glass tokens
  App.tsx                  # 改:拖拽状态管理
tests/canvas/
  orbitLayout.test.ts      # 新
```

---

## Task 1: 防重叠布局(纯函数 + TDD)

**Files:** Create `src/renderer/canvas/orbitLayout.ts`, Test `tests/canvas/orbitLayout.test.ts`

纯函数,无 React 依赖。根据项目数量和每个项目 MCP 数量计算星球位置、安全半径。

- [ ] **Step 1: 写失败测试**

Create `tests/canvas/orbitLayout.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { computeOrbitLayout } from '../../src/renderer/canvas/orbitLayout';

describe('computeOrbitLayout', () => {
  it('returns empty array for no projects', () => {
    expect(computeOrbitLayout([])).toEqual([]);
  });

  it('returns deterministic positions for given input', () => {
    const a = computeOrbitLayout([{ path: '/a', mcpCount: 2 }, { path: '/b', mcpCount: 5 }]);
    const b = computeOrbitLayout([{ path: '/a', mcpCount: 2 }, { path: '/b', mcpCount: 5 }]);
    expect(a).toEqual(b);
  });

  it('positions one project at origin', () => {
    const r = computeOrbitLayout([{ path: '/a', mcpCount: 0 }]);
    expect(r).toHaveLength(1);
    expect(r[0].x).toBeGreaterThanOrEqual(0);
    expect(r[0].y).toBeGreaterThanOrEqual(0);
  });

  it('7 projects are all non-overlapping by safe radius', () => {
    const inputs = Array.from({ length: 7 }, (_, i) => ({ path: `/p${i}`, mcpCount: Math.floor(Math.random() * 6) }));
    const r = computeOrbitLayout(inputs);
    for (let i = 0; i < r.length; i++) {
      for (let j = i + 1; j < r.length; j++) {
        const dx = r[i].x - r[j].x;
        const dy = r[i].y - r[j].y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        expect(dist).toBeGreaterThanOrEqual(r[i].safeRadius + r[j].safeRadius);
      }
    }
  });

  it('planet radius is bounded between min and max regardless of mcpCount', () => {
    const tiny = computeOrbitLayout([{ path: '/a', mcpCount: 0 }]);
    const huge = computeOrbitLayout([{ path: '/a', mcpCount: 100 }]);
    expect(tiny[0].planetRadius).toBeGreaterThanOrEqual(48);
    expect(huge[0].planetRadius).toBeLessThanOrEqual(100);
    expect(huge[0].planetRadius).toBeGreaterThanOrEqual(tiny[0].planetRadius);
  });
});
```

- [ ] **Step 2: 跑测试确认失败** — `npx vitest run tests/canvas/orbitLayout.test.ts` → FAIL。

- [ ] **Step 3: 写实现**

```typescript
export interface ProjectLayoutInput { path: string; mcpCount: number; }
export interface PlanetPosition {
  path: string; x: number; y: number;
  planetRadius: number; orbitRadius: number; safeRadius: number;
}

const MIN_PLANET_RADIUS = 50;
const MAX_PLANET_RADIUS = 90;
const MIN_ORBIT_RADIUS = 30;
const MAX_ORBIT_RADIUS = 66;
const MIN_SAFE_GAP = 32;

function radius(mcpCount: number): { planetRadius: number; orbitRadius: number; safeRadius: number } {
  const planetRadius = Math.min(MAX_PLANET_RADIUS, MIN_PLANET_RADIUS + Math.min(mcpCount, 10) * 4);
  const orbitRadius = Math.min(MAX_ORBIT_RADIUS, MIN_ORBIT_RADIUS + Math.min(mcpCount, 10) * 3.6);
  const safeRadius = planetRadius + orbitRadius + MIN_SAFE_GAP;
  return { planetRadius, orbitRadius, safeRadius };
}

// 极坐标螺旋布局:从中心开始按黄金角螺旋外扩,已放置的星球做排斥检测
export function computeOrbitLayout(projects: ProjectLayoutInput[]): PlanetPosition[] {
  if (!projects.length) return [];
  const result: PlanetPosition[] = [];
  const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5)); // ~2.4 rad = 137.5°

  for (let i = 0; i < projects.length; i++) {
    const r = radius(projects[i].mcpCount);
    let x: number, y: number;
    let placed = false;
    // 从中心向外尝试
    for (let ring = 0; !placed; ring++) {
      const d = ring * 200;
      const angle = i * GOLDEN_ANGLE + ring * 0.1;
      x = d * Math.cos(angle) + 500; // 画布参考中心
      y = d * Math.sin(angle) + 400;
      // 检测是否与已放置的星球重叠
      let collides = false;
      for (const p of result) {
        const dx = x - p.x, dy = y - p.y;
        if (Math.sqrt(dx * dx + dy * dy) < r.safeRadius + p.safeRadius) {
          collides = true; break;
        }
      }
      if (!collides || ring > 500) placed = true;
    }
    result.push({ path: projects[i].path, x, y, ...r });
  }
  return result;
}
```

- [ ] **Step 4: 跑测试确认通过**(5 个)。

- [ ] **Step 5: Commit**
```bash
git add src/renderer/canvas/orbitLayout.ts tests/canvas/orbitLayout.test.ts
git commit -m "feat(canvas): polar-spiral orbit layout — non-overlapping planet positions"
```

---

## Task 2: 液态玻璃 theme tokens

**Files:** Modify `src/renderer/theme/tokens.css`

追加新 token,不删不改现有 token。

- [ ] **Step 1: 追加 token**

在 `src/renderer/theme/tokens.css` 的 `:root` 块末尾(但还在浅色 `}` 之前)追加:

```css
  --glass-surface: rgba(251,250,247,.38);
  --glass-surface-strong: rgba(251,250,247,.55);
  --glass-border: rgba(255,255,255,.68);
  --glass-highlight: rgba(255,255,255,.72);
  --glass-shadow: 0 16px 48px rgba(90,70,45,.14);
  --planet-bg: radial-gradient(circle at 30% 22%,rgba(255,255,255,.88),rgba(251,250,247,.34) 38%,rgba(217,119,87,.22) 68%,rgba(140,100,70,.14));
  --orbit-line: rgba(217,119,87,.22);
  --orbit-line-active: rgba(217,119,87,.48);
  --gravity-glow: rgba(217,119,87,.18);
  --space-dust: radial-gradient(rgba(160,130,100,.10) 1px,transparent 1px);
```

在 `[data-theme="dark"]` 块内追加:

```css
  --glass-surface: rgba(48,45,41,.38);
  --glass-surface-strong: rgba(48,45,41,.55);
  --glass-border: rgba(255,255,255,.14);
  --glass-highlight: rgba(255,255,255,.18);
  --glass-shadow: 0 16px 48px rgba(0,0,0,.35);
  --planet-bg: radial-gradient(circle at 30% 20%,rgba(255,255,255,.55),rgba(224,138,107,.28) 34%,rgba(40,36,33,.42) 70%);
  --orbit-line: rgba(224,138,107,.28);
  --orbit-line-active: rgba(224,138,107,.56);
  --gravity-glow: rgba(224,138,107,.14);
  --space-dust: radial-gradient(rgba(255,255,255,.12) 1px,transparent 1px);
```

- [ ] **Step 2: 确认 tsc + build** — `npx tsc --noEmit` clean;`npm run build` 无 error。

- [ ] **Step 3: Commit**
```bash
git add src/renderer/theme/tokens.css
git commit -m "feat(theme): liquid glass tokens for planets and orbit graph"
```

---

## Task 3: MCP 卫星玻璃胶囊(McpSatellite)

**Files:** Create `src/renderer/canvas/McpSatellite.tsx`

单个 MCP 的小玻璃胶囊,可独立复用。

- [ ] **Step 1: 写组件**

```tsx
import React from 'react';

export type McpStatus = 'applied' | 'pending' | 'global' | 'drift';

const STATUS_COLOR: Record<McpStatus, string> = {
  applied: 'var(--state-applied)',
  pending: 'var(--state-pending)',
  global: 'var(--accent)',
  drift: 'var(--state-drift)',
};

export function McpSatellite({ label, hasSecrets, status }: {
  label: string; hasSecrets?: boolean; status: McpStatus;
}) {
  return (
    <div style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      padding: '3px 10px', borderRadius: 14, fontSize: 11,
      background: 'var(--glass-surface)',
      backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)',
      border: '1px solid var(--glass-border)',
      boxShadow: 'var(--glass-shadow)',
      color: 'var(--text-primary)',
    }}>
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: STATUS_COLOR[status], flexShrink: 0 }} />
      {label}
      {hasSecrets && <span title="含密钥" style={{ color: 'var(--text-muted)' }}>🔑</span>}
    </div>
  );
}
```

- [ ] **Step 2: tsc clean;commit**
```bash
git add src/renderer/canvas/McpSatellite.tsx
git commit -m "feat(canvas): MCP satellite glass capsule component"
```

---

## Task 4: 项目星球节点(ProjectPlanet)

**Files:** Create `src/renderer/canvas/ProjectPlanet.tsx`

替代 `ProjectNode`，内聚星球、轨道、卫星、drag-over 引力场、吸附预览。

- [ ] **Step 1: 写组件**

```tsx
import React from 'react';
import type { NodeProps } from 'reactflow';
import { McpSatellite, type McpStatus } from './McpSatellite';
import type { LibraryMcp } from '../../main/station/types';
import type { PlanetPosition } from './orbitLayout';

interface ProjectPlanetData extends PlanetPosition {
  name: string;
  mcp: { id: string; hasSecrets: boolean; status: McpStatus }[];
  libraryMcp: Record<string, LibraryMcp>;
  draggingMcpId: string | null;
  isDragOver: boolean;
  onDropMcp?: (path: string, mcpId: string) => void;
  onSelect?: () => void;
}

export function ProjectPlanet({ data }: NodeProps<ProjectPlanetData>) {
  const { name, mcp = [], planetRadius, orbitRadius, draggingMcpId, isDragOver } = data;
  const library = data.libraryMcp ?? {};

  const satAngle = (idx: number) => (idx / Math.max(mcp.length, 1)) * 2 * Math.PI - Math.PI / 2;

  return (
    <div
      onClick={() => data.onSelect?.()}
      onDragOver={e => { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; }}
      onDrop={e => {
        const id = e.dataTransfer.getData('application/x-mcp-id');
        if (id && data.onDropMcp) data.onDropMcp(data.path, id);
      }}
      style={{
        width: planetRadius * 2 + orbitRadius * 2 + 20,
        height: planetRadius * 2 + orbitRadius * 2 + 20,
        position: 'relative',
        cursor: 'pointer',
      }}>
      {/* 引力场 glow */}
      {isDragOver && (
        <div style={{
          position: 'absolute', inset: 0, borderRadius: '50%',
          background: `radial-gradient(circle, var(--gravity-glow), transparent 70%)`,
          opacity: .7, zIndex: 0,
        }} />
      )}

      {/* 轨道线 */}
      {mcp.length > 0 && (
        <div style={{
          position: 'absolute',
          left: '50%', top: '50%',
          width: orbitRadius * 2 + planetRadius * 2,
          height: orbitRadius * 2 + planetRadius * 2,
          transform: 'translate(-50%,-50%)',
          borderRadius: '50%',
          border: `1px solid ${isDragOver ? 'var(--orbit-line-active)' : 'var(--orbit-line)'}`,
          zIndex: 0, pointerEvents: 'none',
        }} />
      )}

      {/* 行星本体 */}
      <div
        className="serif"
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
          justifyContent: 'center', transition: 'box-shadow .2s ease',
          fontSize: Math.max(11, Math.round(planetRadius / 3.5)),
          fontWeight: 600, color: 'var(--text-primary)',
        }}>
        <span>{name}</span>
        <span style={{ fontSize: Math.max(9, Math.round(planetRadius / 5)),
          color: 'var(--text-muted)', fontWeight: 400 }}>
          {mcp.length} MCP
        </span>
        {/* 含密钥总数 */}
        {mcp.filter(m => m.hasSecrets).length > 0 && (
          <span style={{ fontSize: 9, color: 'var(--text-muted)' }}>
            {mcp.filter(m => m.hasSecrets).length} 🔑
          </span>
        )}
      </div>

      {/* 卫星胶囊 */}
      {mcp.map((m, i) => {
        const a = satAngle(i);
        const sx = planetRadius + orbitRadius + Math.cos(a) * (orbitRadius + planetRadius / 2) + orbitRadius + planetRadius - 8;
        const sy = planetRadius + orbitRadius + Math.sin(a) * (orbitRadius + planetRadius / 2) + orbitRadius + planetRadius - 8;
        return (
          <div key={m.id} style={{
            position: 'absolute', left: sx - 12, top: sy + 3,
            transform: 'translate(-50%,-50%)', zIndex: 3, pointerEvents: 'none',
          }}>
            <McpSatellite label={m.id} hasSecrets={m.hasSecrets} status={m.status} />
          </div>
        );
      })}

      {/* 拖入后的临时吸附预览 */}
      {isDragOver && draggingMcpId && library[draggingMcpId] && (
        <div style={{
          position: 'absolute',
          left: '50%', top: '50%',
          transform: `translate(-50%,-50%) translateY(-${planetRadius + orbitRadius - 6}px)`,
          zIndex: 4, pointerEvents: 'none', opacity: .85,
        }}>
          <McpSatellite label={draggingMcpId} hasSecrets={library[draggingMcpId].hasSecrets} status="pending" />
          <span style={{ fontSize: 10, color: 'var(--state-pending)', marginLeft: 4 }}>+</span>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: tsc clean;commit**
```bash
git add src/renderer/canvas/ProjectPlanet.tsx
git commit -m "feat(canvas): planet node with orbits, satellites, gravity glow, snap preview"
```

---

## Task 5: 重写 Canvas 使用星球布局

**Files:** Modify `src/renderer/canvas/Canvas.tsx`(替换内容)

- [ ] **Step 1: 重写 Canvas**

```tsx
import React, { useMemo } from 'react';
import ReactFlow, { Background, Controls } from 'reactflow';
import 'reactflow/dist/style.css';
import { ProjectPlanet } from './ProjectPlanet';
import { computeOrbitLayout } from './orbitLayout';
import type { ProjectState } from '../../main/types';
import type { LibraryMcp } from '../../main/station/types';
import type { McpStatus } from './McpSatellite';

const nodeTypes = { planet: ProjectPlanet };

function statusOf(mcpId: string, project: ProjectState, assignedIds: string[], landedIds: Set<string>): McpStatus {
  if (!assignedIds.includes(mcpId)) return 'global'; // 仍从全局注入
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
    const inputs = projects.map(p => ({
      path: p.path,
      mcpCount: p.mcp.length,
    }));
    return computeOrbitLayout(inputs);
  }, [projects]);

  const byPath = useMemo(() => {
    const m = new Map<string, typeof layout[0]>();
    for (const l of layout) m.set(l.path, l);
    return m;
  }, [layout]);

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
          variant="dots" gap={28} size={1.2}
          color="var(--orbit-line)"
          style={{ opacity: .35 }}
        />
        <Controls />
      </ReactFlow>
    </div>
  );
}
```

- [ ] **Step 2: tsc clean;commit**
```bash
git add src/renderer/canvas/Canvas.tsx
git commit -m "feat(canvas): planet-graph canvas with orbit layout and gravity drag"
```

---

## Task 6: 库 + App 拖拽集成

**Files:** Modify `src/renderer/rail/LibraryRail.tsx`, Modify `src/renderer/App.tsx`

- [ ] **Step 1: 升级 LibraryRail 视觉为玻璃胶囊**

把 `LibraryRail.tsx` 内层 `<div>`(draggable) 的 `style.background` 从 `var(--bg-surface)` 改为 `var(--glass-surface)`,加 `backdropFilter:'blur(10px)'` 和 `border` 从 `--border` 改为 `var(--glass-border)`。最小改动,不改结构。

- [ ] **Step 2: App.tsx 加 draggingMcpId 状态 + 透传**

在现有 `useState` 后加:
```tsx
  const [draggingMcpId, setDraggingMcpId] = useState<string | null>(null);
```
把 `Canvas` 的 props 从现有换成新的(带 `desiredMcp`, `lastApplied`, `draggingMcpId`):
```tsx
        <Canvas
          projects={projects}
          desiredMcp={desired?.library.mcp ?? {}}
          lastApplied={desired?.lastApplied ?? {}}
          onSelect={setSelected}
          onDropMcp={onDropMcp}
          draggingMcpId={draggingMcpId}
        />
```
给 `LibraryRail` 加两个 prop:拖拽开始时 setDraggingMcpId,结束时清 null。在不改变 `LibraryRail` 签名的情况下,给它新加 `onDragStartMcp` 和 `onDragEndMcp` props(两个参数都传 `setDraggingMcpId`)。

在 `LibraryRail.tsx`:
- 加 props: `onDragStartMcp?: (id: string) => void; onDragEndMcp?: () => void;`
- 在 `onDragStart` 里调用 `onDragStartMcp?.(m.id);`
- 在 `onDragEnd` (新)里调用 `onDragEndMcp?.();`。给 draggable div 加 `onDragEnd={() => onDragEndMcp?.()}`。

- [ ] **Step 3: tsc clean;commit**
```bash
git add src/renderer/rail/LibraryRail.tsx src/renderer/App.tsx
git commit -m "feat(ui): glass library rail + dragging state for gravity snap"
```

---

## Task 7: 整体验证

**Files:** 无(纯验证)

- [ ] **Step 1: 全单测** — `npx vitest run`。M2 的 55 + orbitLayout 5 = 60,应全绿。报告总数。

- [ ] **Step 2: 类型** — `npx tsc --noEmit` clean。

- [ ] **Step 3: 构建** — `npm run build` 无 error。

- [ ] **Step 4: 手动验证(人工)** — `npm run dev`:
  - 7 个项目不再重叠,呈螺旋/环形排布。
  - 每个项目是玻璃星球,已装配 MCP 作为轨道卫星挂在星球周围。
  - 拖 MCP 芯片时所有星球显示引力 glow。
  - 拖近某星球出现吸附预览(轨道高亮 + 半透明卫星)。
  - 松手后 MCP 成为该星球新卫星,Apply 计数更新。
  - 深色切换后玻璃质感温暖、不像黑蓝科幻。

---

## 完成标准(M2.6)

- [ ] orbitLayout 纯函数 5 个测试全绿,7 项目无重叠断言通过。
- [ ] Build 通过,旧 CapabilityChip / ProjectNode 已移除而不影响构建。
- [ ] 渲染的不再是卡片面板,而是星球图谱。
- [ ] 拖拽近星球出现引力场 + 吸附预览 + 落位。
- [ ] 现有 MCP assemble / apply / cleanup 全部仍可用。
