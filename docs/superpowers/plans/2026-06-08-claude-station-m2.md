# Claude Station — M2 (MCP 装配 + Apply,不含全局清理) 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让用户把库里的 MCP 拖到某个项目上完成"装配",点 Apply 后按 `hasSecrets` 安全地写入项目的 `.mcp.json`(不含密钥)或 `~/.claude.json` 项目本地作用域(含密钥),全程 diff 预览 + 写前备份 + 漂移检测,绝不动 `~/.claude.json` 顶层那 6 个全局 MCP(全局清理留给 M2.5)。

**Architecture:** 在主进程新增 `src/main/station/` 子系统:一套**纯函数**(种子化、装配、编译目标、JSON 安全合并、diff、漂移)+ 少量 I/O 包装(store 读写、备份、apply 编排)。期望状态持久化到 `~/.claude-station/state.json`,首次由 M1 的 `buildState()` 反向导入播种。渲染层把 M1 的只读画布升级为可交互:左栏库 chip 可拖、项目节点可接收 drop = 写期望状态;顶栏 Apply 按钮带待改计数,点击弹逐文件 diff,确认后备份并写入。

**Tech Stack:** 沿用 M1 — Electron + electron-vite + TypeScript;React + React Flow(HTML5 原生拖放);Vitest。无新依赖。

参考 spec:`docs/superpowers/specs/2026-06-08-claude-station-design.md`(§2 三层/反向导入、§2.3 Apply、§2.4 漂移、§7 数据模型、§8 安全)。已确认决策:密钥按 `hasSecrets` 路由(`.mcp.json` vs local scope,**不用 `.env`**);M2 范围 = 1-5,全局清理延后。

**复用的 M1 模块(已存在,导入勿重写):**
- `src/main/types.ts`:`McpServerDef = { type?, command?, args?, env?, url? }`、`McpCapability = { id, scope, def, hasSecrets }`、`InferredState`、`ProjectState`。
- `src/main/scanner/paths.ts`:`projectMcpJson(path)`、`resolvePaths(home)`(给 `claudeJson` 路径)。
- `src/main/scanner/buildState.ts`:`buildState(home?) → InferredState`。
- `src/main/ipc.ts`:`registerIpc()`(已注册 `station:getState`)。
- 渲染层:`App.tsx`、`canvas/Canvas.tsx`、`canvas/ProjectNode.tsx`、`canvas/CapabilityChip.tsx`、`panel/DetailPanel.tsx`。

---

## 文件结构

```
src/main/station/
  paths.ts        # ~/.claude-station 目录路径(可注入 home):stationDir/stateFile/backupsDir
  types.ts        # StationState / LibraryMcp / ProjectAssignment / AppliedSnapshot / ApplyPlan
  store.ts        # loadState / saveState(I/O:读写 state.json,缺省返回空态)
  seed.ts         # seedStateFromInferred(纯):由 InferredState 播种库 + 现状装配
  assign.ts       # assignMcp / unassignMcp(纯:增删某项目的库 mcp 引用)
  compile.ts      # compileProjectTargets(纯:按 hasSecrets 把装配分流成 mcpJson / localScope 两组)
  merge.ts        # mergeMcpJson / mergeLocalScope(纯:只替换 mcpServers 键,保留其余字段)
  diff.ts         # diffServers(纯:added/removed/changed)
  backup.ts       # backupFiles(I/O:写前复制到 backups/<时间戳>/)
  drift.ts        # detectDrift(纯:真实 vs lastApplied 快照)
  apply.ts        # computeApplyPlan(纯)+ executeApply(I/O 编排:备份→写→存快照)
src/renderer/
  rail/LibraryRail.tsx    # 左栏:库 MCP 可拖 chip(HTML5 draggable)
  apply/ApplyBar.tsx      # 顶栏 Apply 按钮 + 待改计数
  apply/DiffModal.tsx     # 逐文件 diff 预览模态
  (修改) canvas/ProjectNode.tsx  # 接收 drop = 装配
  (修改) canvas/Canvas.tsx       # 透传 onAssign
  (修改) App.tsx                 # 装载 station 状态、装配、apply 流程
tests/station/  *.test.ts        # 每个纯函数/IO 模块一份
```

---

## 数据模型(`src/main/station/types.ts` 概要)

```typescript
import type { McpServerDef } from '../types';

export interface LibraryMcp { id: string; def: McpServerDef; hasSecrets: boolean; }
export interface StationLibrary { mcp: Record<string, LibraryMcp>; } // 按 id
export interface ProjectAssignment { mcp: string[]; }                // 库 mcp id 列表

// 上次 Apply 写入的内容,用于算 diff 和检测漂移
export interface AppliedSnapshot {
  mcpJson: Record<string, McpServerDef>;     // 写进 .mcp.json 的 server
  localScope: Record<string, McpServerDef>;  // 写进 ~/.claude.json 本地作用域的 server
}

export interface StationState {
  version: number;
  library: StationLibrary;
  assignments: Record<string, ProjectAssignment>;  // 按项目路径
  lastApplied: Record<string, AppliedSnapshot>;    // 按项目路径
}

// 单项目的 Apply 计划(供 diff 预览)
export interface FileChange {
  file: string;                       // 绝对路径
  kind: 'mcpjson' | 'localscope';
  before: Record<string, McpServerDef>;
  after: Record<string, McpServerDef>;
  added: string[]; removed: string[]; changed: string[];
}
export interface ApplyPlan { changes: FileChange[]; } // 只含有变化的文件
```

---

## Task 1: station 路径 + 数据类型

**Files:** Create `src/main/station/paths.ts`, `src/main/station/types.ts`

- [ ] **Step 1: 写 paths.ts**

```typescript
import { join } from 'node:path';
import { homedir } from 'node:os';

export interface StationPaths { stationDir: string; stateFile: string; backupsDir: string; }

export function stationPaths(home: string = homedir()): StationPaths {
  const stationDir = join(home, '.claude-station');
  return { stationDir, stateFile: join(stationDir, 'state.json'), backupsDir: join(stationDir, 'backups') };
}
```

- [ ] **Step 2: 写 types.ts**

```typescript
import type { McpServerDef } from '../types';

export interface LibraryMcp { id: string; def: McpServerDef; hasSecrets: boolean; }
export interface StationLibrary { mcp: Record<string, LibraryMcp>; }
export interface ProjectAssignment { mcp: string[]; }

export interface AppliedSnapshot {
  mcpJson: Record<string, McpServerDef>;
  localScope: Record<string, McpServerDef>;
}

export interface StationState {
  version: number;
  library: StationLibrary;
  assignments: Record<string, ProjectAssignment>;
  lastApplied: Record<string, AppliedSnapshot>;
}

export interface FileChange {
  file: string;
  kind: 'mcpjson' | 'localscope';
  before: Record<string, McpServerDef>;
  after: Record<string, McpServerDef>;
  added: string[]; removed: string[]; changed: string[];
}
export interface ApplyPlan { changes: FileChange[]; }
```

- [ ] **Step 3: tsc + commit**

Run: `cd claude-station && npx tsc --noEmit` → clean.
```bash
git add src/main/station/paths.ts src/main/station/types.ts
git commit -m "feat(station): paths + state data model"
```

---

## Task 2: state store(load/save)

**Files:** Create `src/main/station/store.ts`, Test `tests/station/store.test.ts`

- [ ] **Step 1: 写失败测试**

```typescript
import { describe, it, expect } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { loadState, saveState, emptyState } from '../../src/main/station/store';

describe('station store', () => {
  it('returns emptyState when no file', () => {
    const home = mkdtempSync(join(tmpdir(), 'cs-st-'));
    const s = loadState(home);
    expect(s).toEqual(emptyState());
    rmSync(home, { recursive: true, force: true });
  });

  it('round-trips save then load', () => {
    const home = mkdtempSync(join(tmpdir(), 'cs-st-'));
    const s = emptyState();
    s.library.mcp['firecrawl'] = { id: 'firecrawl', def: { command: 'npx' }, hasSecrets: true };
    s.assignments['/p'] = { mcp: ['firecrawl'] };
    saveState(s, home);
    expect(loadState(home)).toEqual(s);
    rmSync(home, { recursive: true, force: true });
  });

  it('returns emptyState on malformed file', () => {
    const home = mkdtempSync(join(tmpdir(), 'cs-st-'));
    saveState(emptyState(), home); // ensures dir exists
    const { writeFileSync } = require('node:fs');
    const { stationPaths } = require('../../src/main/station/paths');
    writeFileSync(stationPaths(home).stateFile, '{ bad');
    expect(loadState(home)).toEqual(emptyState());
    rmSync(home, { recursive: true, force: true });
  });
});
```

- [ ] **Step 2: 跑测试确认失败** — `npx vitest run tests/station/store.test.ts` → FAIL（模块不存在）。

- [ ] **Step 3: 写实现**

```typescript
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { homedir } from 'node:os';
import type { StationState } from './types';
import { stationPaths } from './paths';

export function emptyState(): StationState {
  return { version: 1, library: { mcp: {} }, assignments: {}, lastApplied: {} };
}

export function loadState(home: string = homedir()): StationState {
  const { stateFile } = stationPaths(home);
  if (!existsSync(stateFile)) return emptyState();
  try { return JSON.parse(readFileSync(stateFile, 'utf8')); } catch { return emptyState(); }
}

export function saveState(state: StationState, home: string = homedir()): void {
  const { stateFile } = stationPaths(home);
  mkdirSync(dirname(stateFile), { recursive: true });
  writeFileSync(stateFile, JSON.stringify(state, null, 2));
}
```

- [ ] **Step 4: 跑测试确认通过**（3 个）。

- [ ] **Step 5: Commit**
```bash
git add src/main/station/store.ts tests/station/store.test.ts
git commit -m "feat(station): state store load/save with empty + malformed fallback"
```

---

## Task 3: 由反向导入播种状态

**Files:** Create `src/main/station/seed.ts`, Test `tests/station/seed.test.ts`

纯函数:库 = user-scope MCP +（各项目已有 MCP，按 id 去重，user-scope 优先）;装配 = 各项目当前显式 MCP 的 id 列表。

- [ ] **Step 1: 写失败测试**

```typescript
import { describe, it, expect } from 'vitest';
import { seedStateFromInferred } from '../../src/main/station/seed';
import type { InferredState } from '../../src/main/types';

const inferred: InferredState = {
  userScope: {
    mcp: [{ id: 'firecrawl', scope: 'user', def: { command: 'npx', env: { K: 'v' } }, hasSecrets: true }],
    skills: [], plugins: [],
  },
  projects: [
    { path: '/p1', mcp: [
        { id: 'firecrawl', scope: 'project-local', def: { command: 'npx', env: { K: 'v' } }, hasSecrets: true },
        { id: 'exa', scope: 'project-mcpjson', def: { command: 'exa' }, hasSecrets: false },
      ], skills: [], plugins: [] },
    { path: '/p2', mcp: [], skills: [], plugins: [] },
  ],
};

describe('seedStateFromInferred', () => {
  it('library contains user-scope + project MCP deduped by id', () => {
    const s = seedStateFromInferred(inferred);
    expect(Object.keys(s.library.mcp).sort()).toEqual(['exa', 'firecrawl']);
    expect(s.library.mcp['exa'].hasSecrets).toBe(false);
    expect(s.library.mcp['firecrawl'].hasSecrets).toBe(true);
  });

  it('assignments mirror each project current explicit MCP', () => {
    const s = seedStateFromInferred(inferred);
    expect(s.assignments['/p1'].mcp.sort()).toEqual(['exa', 'firecrawl']);
    expect(s.assignments['/p2'].mcp).toEqual([]);
  });

  it('lastApplied starts empty', () => {
    expect(seedStateFromInferred(inferred).lastApplied).toEqual({});
  });
});
```

- [ ] **Step 2: 跑测试确认失败**。

- [ ] **Step 3: 写实现**

```typescript
import type { InferredState } from '../types';
import type { StationState } from './types';

export function seedStateFromInferred(inferred: InferredState): StationState {
  const library: StationState['library'] = { mcp: {} };
  for (const m of inferred.userScope.mcp) {
    library.mcp[m.id] = { id: m.id, def: m.def, hasSecrets: m.hasSecrets };
  }
  const assignments: StationState['assignments'] = {};
  for (const p of inferred.projects) {
    for (const m of p.mcp) {
      if (!library.mcp[m.id]) library.mcp[m.id] = { id: m.id, def: m.def, hasSecrets: m.hasSecrets };
    }
    assignments[p.path] = { mcp: p.mcp.map(m => m.id) };
  }
  return { version: 1, library, assignments, lastApplied: {} };
}
```

- [ ] **Step 4: 跑测试确认通过**（3 个）。

- [ ] **Step 5: Commit**
```bash
git add src/main/station/seed.ts tests/station/seed.test.ts
git commit -m "feat(station): seed desired state from reverse-imported InferredState"
```

---

## Task 4: 装配 / 取消装配(纯函数)

**Files:** Create `src/main/station/assign.ts`, Test `tests/station/assign.test.ts`

不可变地增删某项目的库 mcp 引用。装配不存在于库的 id 是无效操作（返回原状态不变）。重复装配幂等。

- [ ] **Step 1: 写失败测试**

```typescript
import { describe, it, expect } from 'vitest';
import { assignMcp, unassignMcp } from '../../src/main/station/assign';
import { emptyState } from '../../src/main/station/store';

function base() {
  const s = emptyState();
  s.library.mcp['exa'] = { id: 'exa', def: { command: 'exa' }, hasSecrets: false };
  return s;
}

describe('assignMcp / unassignMcp', () => {
  it('assigns a library mcp to a project (immutably)', () => {
    const s = base();
    const next = assignMcp(s, '/p', 'exa');
    expect(next.assignments['/p'].mcp).toEqual(['exa']);
    expect(s.assignments['/p']).toBeUndefined(); // original untouched
  });

  it('is idempotent on duplicate assign', () => {
    let s = base();
    s = assignMcp(s, '/p', 'exa');
    s = assignMcp(s, '/p', 'exa');
    expect(s.assignments['/p'].mcp).toEqual(['exa']);
  });

  it('ignores assigning an id not in library', () => {
    const s = base();
    const next = assignMcp(s, '/p', 'ghost');
    expect(next).toEqual(s);
  });

  it('unassign removes the id', () => {
    let s = base();
    s = assignMcp(s, '/p', 'exa');
    s = unassignMcp(s, '/p', 'exa');
    expect(s.assignments['/p'].mcp).toEqual([]);
  });
});
```

- [ ] **Step 2: 跑测试确认失败**。

- [ ] **Step 3: 写实现**

```typescript
import type { StationState } from './types';

export function assignMcp(state: StationState, projectPath: string, mcpId: string): StationState {
  if (!state.library.mcp[mcpId]) return state;
  const current = state.assignments[projectPath]?.mcp ?? [];
  if (current.includes(mcpId)) return state;
  return {
    ...state,
    assignments: { ...state.assignments, [projectPath]: { mcp: [...current, mcpId] } },
  };
}

export function unassignMcp(state: StationState, projectPath: string, mcpId: string): StationState {
  const current = state.assignments[projectPath]?.mcp ?? [];
  return {
    ...state,
    assignments: { ...state.assignments, [projectPath]: { mcp: current.filter(id => id !== mcpId) } },
  };
}
```

- [ ] **Step 4: 跑测试确认通过**（4 个）。

- [ ] **Step 5: Commit**
```bash
git add src/main/station/assign.ts tests/station/assign.test.ts
git commit -m "feat(station): immutable assign/unassign mcp to project"
```

---

## Task 5: 编译目标(按 hasSecrets 分流)

**Files:** Create `src/main/station/compile.ts`, Test `tests/station/compile.test.ts`

把某项目的装配编译成两组 server map:`mcpJson`（hasSecrets=false）与 `localScope`（hasSecrets=true）。库里找不到的 id 跳过。

- [ ] **Step 1: 写失败测试**

```typescript
import { describe, it, expect } from 'vitest';
import { compileProjectTargets } from '../../src/main/station/compile';
import { emptyState } from '../../src/main/station/store';

function lib() {
  const s = emptyState();
  s.library.mcp['exa'] = { id: 'exa', def: { command: 'exa' }, hasSecrets: false };
  s.library.mcp['firecrawl'] = { id: 'firecrawl', def: { command: 'npx', env: { K: 'v' } }, hasSecrets: true };
  s.assignments['/p'] = { mcp: ['exa', 'firecrawl'] };
  return s;
}

describe('compileProjectTargets', () => {
  it('routes non-secret to mcpJson, secret to localScope', () => {
    const t = compileProjectTargets(lib(), '/p');
    expect(Object.keys(t.mcpJson)).toEqual(['exa']);
    expect(t.mcpJson['exa']).toEqual({ command: 'exa' });
    expect(Object.keys(t.localScope)).toEqual(['firecrawl']);
    expect(t.localScope['firecrawl']).toEqual({ command: 'npx', env: { K: 'v' } });
  });

  it('empty when no assignment', () => {
    const t = compileProjectTargets(emptyState(), '/none');
    expect(t).toEqual({ mcpJson: {}, localScope: {} });
  });
});
```

- [ ] **Step 2: 跑测试确认失败**。

- [ ] **Step 3: 写实现**

```typescript
import type { McpServerDef } from '../types';
import type { StationState } from './types';

export interface ProjectTargets {
  mcpJson: Record<string, McpServerDef>;
  localScope: Record<string, McpServerDef>;
}

export function compileProjectTargets(state: StationState, projectPath: string): ProjectTargets {
  const ids = state.assignments[projectPath]?.mcp ?? [];
  const mcpJson: Record<string, McpServerDef> = {};
  const localScope: Record<string, McpServerDef> = {};
  for (const id of ids) {
    const entry = state.library.mcp[id];
    if (!entry) continue;
    if (entry.hasSecrets) localScope[id] = entry.def;
    else mcpJson[id] = entry.def;
  }
  return { mcpJson, localScope };
}
```

- [ ] **Step 4: 跑测试确认通过**（2 个）。

- [ ] **Step 5: Commit**
```bash
git add src/main/station/compile.ts tests/station/compile.test.ts
git commit -m "feat(station): compile assignments into mcpJson/localScope targets by hasSecrets"
```

---

## Task 6: JSON 安全合并(只动 mcpServers,保留其余字段)

**Files:** Create `src/main/station/merge.ts`, Test `tests/station/merge.test.ts`

这是安全核心:改 `.mcp.json` 和 `~/.claude.json` 时**只替换目标作用域的 mcpServers**,其余字段（尤其 `~/.claude.json` 的 lastCost/projects/其他项目）一字不动。

- [ ] **Step 1: 写失败测试**

```typescript
import { describe, it, expect } from 'vitest';
import { mergeMcpJson, mergeLocalScope } from '../../src/main/station/merge';

describe('mergeMcpJson', () => {
  it('replaces mcpServers, preserves other top-level keys', () => {
    const existing = { mcpServers: { old: { command: 'x' } }, someOtherKey: 42 };
    const next = mergeMcpJson(existing, { exa: { command: 'exa' } });
    expect(next.mcpServers).toEqual({ exa: { command: 'exa' } });
    expect((next as any).someOtherKey).toBe(42);
  });
  it('works from undefined existing', () => {
    expect(mergeMcpJson(undefined, { exa: { command: 'exa' } })).toEqual({ mcpServers: { exa: { command: 'exa' } } });
  });
});

describe('mergeLocalScope', () => {
  it('sets projects[path].mcpServers, preserves top-level mcpServers and lastCost', () => {
    const existing = {
      mcpServers: { globalA: { command: 'g' } },   // 顶层 user-scope: 绝不能动
      projects: { '/p': { lastCost: 9, mcpServers: { stale: { command: 's' } } }, '/other': { x: 1 } },
    };
    const next = mergeLocalScope(existing, '/p', { firecrawl: { command: 'npx' } });
    expect(next.projects['/p'].mcpServers).toEqual({ firecrawl: { command: 'npx' } });
    expect(next.projects['/p'].lastCost).toBe(9);                 // 项目其余字段保留
    expect(next.projects['/other']).toEqual({ x: 1 });            // 其他项目不动
    expect(next.mcpServers).toEqual({ globalA: { command: 'g' } }); // 顶层 user-scope 不动
  });
  it('creates projects + project entry when missing', () => {
    const next = mergeLocalScope({}, '/p', { firecrawl: { command: 'npx' } });
    expect(next.projects['/p'].mcpServers).toEqual({ firecrawl: { command: 'npx' } });
  });
});
```

- [ ] **Step 2: 跑测试确认失败**。

- [ ] **Step 3: 写实现**

```typescript
import type { McpServerDef } from '../types';

export function mergeMcpJson(
  existing: any,
  servers: Record<string, McpServerDef>,
): any {
  return { ...(existing ?? {}), mcpServers: servers };
}

export function mergeLocalScope(
  existing: any,
  projectPath: string,
  servers: Record<string, McpServerDef>,
): any {
  const base = existing ?? {};
  const projects = { ...(base.projects ?? {}) };
  const proj = { ...(projects[projectPath] ?? {}) };
  proj.mcpServers = servers;
  projects[projectPath] = proj;
  return { ...base, projects };
}
```

- [ ] **Step 4: 跑测试确认通过**（4 个）。注意验证顶层 `mcpServers` 在 mergeLocalScope 后保持不变——这是"绝不动 6 个全局 MCP"的保证。

- [ ] **Step 5: Commit**
```bash
git add src/main/station/merge.ts tests/station/merge.test.ts
git commit -m "feat(station): structural JSON merge — replace only target mcpServers, preserve rest"
```

---

## Task 7: server 集 diff

**Files:** Create `src/main/station/diff.ts`, Test `tests/station/diff.test.ts`

- [ ] **Step 1: 写失败测试**

```typescript
import { describe, it, expect } from 'vitest';
import { diffServers } from '../../src/main/station/diff';

describe('diffServers', () => {
  it('reports added/removed/changed by id and deep-equality of def', () => {
    const before = { a: { command: 'a' }, b: { command: 'b' }, c: { command: 'c' } };
    const after  = { a: { command: 'a' }, b: { command: 'B2' }, d: { command: 'd' } };
    const r = diffServers(before, after);
    expect(r.added.sort()).toEqual(['d']);
    expect(r.removed.sort()).toEqual(['c']);
    expect(r.changed.sort()).toEqual(['b']);
  });
  it('empty diff when identical', () => {
    const x = { a: { command: 'a', args: ['1'] } };
    const r = diffServers(x, { a: { command: 'a', args: ['1'] } });
    expect(r.added).toEqual([]); expect(r.removed).toEqual([]); expect(r.changed).toEqual([]);
  });
});
```

- [ ] **Step 2: 跑测试确认失败**。

- [ ] **Step 3: 写实现**

```typescript
import type { McpServerDef } from '../types';

export interface ServerDiff { added: string[]; removed: string[]; changed: string[]; }

export function diffServers(
  before: Record<string, McpServerDef>,
  after: Record<string, McpServerDef>,
): ServerDiff {
  const bk = Object.keys(before), ak = Object.keys(after);
  const added = ak.filter(k => !(k in before));
  const removed = bk.filter(k => !(k in after));
  const changed = ak.filter(k => k in before && JSON.stringify(before[k]) !== JSON.stringify(after[k]));
  return { added, removed, changed };
}
```

- [ ] **Step 4: 跑测试确认通过**（2 个）。

- [ ] **Step 5: Commit**
```bash
git add src/main/station/diff.ts tests/station/diff.test.ts
git commit -m "feat(station): server-set diff (added/removed/changed)"
```

---

## Task 8: 写前备份(I/O)

**Files:** Create `src/main/station/backup.ts`, Test `tests/station/backup.test.ts`

把要改的真实文件先复制到 `~/.claude-station/backups/<时间戳>/`,扁平命名（路径中 `/` 换成 `__`)。时间戳由调用方传入（保持函数可测、不调 Date）。不存在的源文件跳过。

- [ ] **Step 1: 写失败测试**

```typescript
import { describe, it, expect } from 'vitest';
import { mkdtempSync, writeFileSync, existsSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { backupFiles } from '../../src/main/station/backup';
import { stationPaths } from '../../src/main/station/paths';

describe('backupFiles', () => {
  it('copies existing files into backups/<stamp>/, skips missing', () => {
    const home = mkdtempSync(join(tmpdir(), 'cs-bk-'));
    const f1 = join(home, 'a.json'); writeFileSync(f1, '{"x":1}');
    const missing = join(home, 'gone.json');
    const dir = backupFiles([f1, missing], '20260608-000000', home);
    expect(dir).toBe(join(stationPaths(home).backupsDir, '20260608-000000'));
    const files = readdirSync(dir);
    expect(files.length).toBe(1);
    expect(readFileSync(join(dir, files[0]), 'utf8')).toBe('{"x":1}');
    rmSync(home, { recursive: true, force: true });
  });
});
```

- [ ] **Step 2: 跑测试确认失败**。

- [ ] **Step 3: 写实现**

```typescript
import { copyFileSync, existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { stationPaths } from './paths';

export function backupFiles(files: string[], stamp: string, home: string = homedir()): string {
  const dir = join(stationPaths(home).backupsDir, stamp);
  mkdirSync(dir, { recursive: true });
  for (const f of files) {
    if (!existsSync(f)) continue;
    const flat = f.replace(/[/\\]/g, '__').replace(/^__+/, '');
    copyFileSync(f, join(dir, flat));
  }
  return dir;
}
```

- [ ] **Step 4: 跑测试确认通过**（1 个）。

- [ ] **Step 5: Commit**
```bash
git add src/main/station/backup.ts tests/station/backup.test.ts
git commit -m "feat(station): backup target files to timestamped dir before write"
```

---

## Task 9: 漂移检测(纯)

**Files:** Create `src/main/station/drift.ts`, Test `tests/station/drift.test.ts`

对比某项目"真实当前"两组 server（由调用方从真实文件读出）与 `lastApplied` 快照。不一致 = 漂移。从未 Apply（无快照）= 不算漂移（返回 false）。

- [ ] **Step 1: 写失败测试**

```typescript
import { describe, it, expect } from 'vitest';
import { detectDrift } from '../../src/main/station/drift';
import type { AppliedSnapshot } from '../../src/main/station/types';

const snap: AppliedSnapshot = { mcpJson: { exa: { command: 'exa' } }, localScope: {} };

describe('detectDrift', () => {
  it('no snapshot → no drift', () => {
    expect(detectDrift(undefined, { mcpJson: { exa: { command: 'exa' } }, localScope: {} })).toBe(false);
  });
  it('identical → no drift', () => {
    expect(detectDrift(snap, { mcpJson: { exa: { command: 'exa' } }, localScope: {} })).toBe(false);
  });
  it('real file changed → drift', () => {
    expect(detectDrift(snap, { mcpJson: { exa: { command: 'CHANGED' } }, localScope: {} })).toBe(true);
  });
  it('real file gained a server → drift', () => {
    expect(detectDrift(snap, { mcpJson: { exa: { command: 'exa' }, new: { command: 'n' } }, localScope: {} })).toBe(true);
  });
});
```

- [ ] **Step 2: 跑测试确认失败**。

- [ ] **Step 3: 写实现**

```typescript
import type { AppliedSnapshot } from './types';

export function detectDrift(snapshot: AppliedSnapshot | undefined, current: AppliedSnapshot): boolean {
  if (!snapshot) return false;
  return JSON.stringify(snapshot) !== JSON.stringify(current);
}
```

- [ ] **Step 4: 跑测试确认通过**（4 个）。

- [ ] **Step 5: Commit**
```bash
git add src/main/station/drift.ts tests/station/drift.test.ts
git commit -m "feat(station): drift detection vs lastApplied snapshot"
```

---

## Task 10: Apply 计划(纯,供 diff 预览)

**Files:** Create `src/main/station/apply.ts`（先只写 `computeApplyPlan`）, Test `tests/station/applyPlan.test.ts`

对一批项目,计算每个项目两个目标文件的 before/after。before 来自 `lastApplied` 快照（无则空）。只产出有变化的 FileChange。`.mcp.json` 路径用 `projectMcpJson`,local scope 文件是 `~/.claude.json`(由 `resolvePaths(home).claudeJson`)。

- [ ] **Step 1: 写失败测试**

```typescript
import { describe, it, expect } from 'vitest';
import { computeApplyPlan } from '../../src/main/station/apply';
import { emptyState } from '../../src/main/station/store';
import { projectMcpJson, resolvePaths } from '../../src/main/scanner/paths';

function state() {
  const s = emptyState();
  s.library.mcp['exa'] = { id: 'exa', def: { command: 'exa' }, hasSecrets: false };
  s.library.mcp['firecrawl'] = { id: 'firecrawl', def: { command: 'npx', env: { K: 'v' } }, hasSecrets: true };
  s.assignments['/p'] = { mcp: ['exa', 'firecrawl'] };
  return s;
}

describe('computeApplyPlan', () => {
  it('produces mcpjson + localscope changes for a fresh project', () => {
    const plan = computeApplyPlan(state(), ['/p'], '/home');
    const mj = plan.changes.find(c => c.kind === 'mcpjson')!;
    const ls = plan.changes.find(c => c.kind === 'localscope')!;
    expect(mj.file).toBe(projectMcpJson('/p'));
    expect(mj.added).toEqual(['exa']);
    expect(ls.file).toBe(resolvePaths('/home').claudeJson);
    expect(ls.added).toEqual(['firecrawl']);
  });

  it('no changes when assignment equals lastApplied', () => {
    const s = state();
    s.lastApplied['/p'] = { mcpJson: { exa: { command: 'exa' } }, localScope: { firecrawl: { command: 'npx', env: { K: 'v' } } } };
    const plan = computeApplyPlan(s, ['/p'], '/home');
    expect(plan.changes).toEqual([]);
  });
});
```

- [ ] **Step 2: 跑测试确认失败**。

- [ ] **Step 3: 写实现(computeApplyPlan)**

```typescript
import { homedir } from 'node:os';
import type { ApplyPlan, FileChange, StationState, AppliedSnapshot } from './types';
import { compileProjectTargets } from './compile';
import { diffServers } from './diff';
import { projectMcpJson, resolvePaths } from '../scanner/paths';

function change(file: string, kind: FileChange['kind'], before: any, after: any): FileChange | null {
  const d = diffServers(before, after);
  if (!d.added.length && !d.removed.length && !d.changed.length) return null;
  return { file, kind, before, after, added: d.added, removed: d.removed, changed: d.changed };
}

export function computeApplyPlan(state: StationState, projectPaths: string[], home: string = homedir()): ApplyPlan {
  const claudeJson = resolvePaths(home).claudeJson;
  const changes: FileChange[] = [];
  for (const path of projectPaths) {
    const target = compileProjectTargets(state, path);
    const snap: AppliedSnapshot = state.lastApplied[path] ?? { mcpJson: {}, localScope: {} };
    const mj = change(projectMcpJson(path), 'mcpjson', snap.mcpJson, target.mcpJson);
    const ls = change(claudeJson, 'localscope', snap.localScope, target.localScope);
    if (mj) changes.push(mj);
    if (ls) changes.push(ls);
  }
  return { changes };
}
```

- [ ] **Step 4: 跑测试确认通过**（2 个）。

- [ ] **Step 5: Commit**
```bash
git add src/main/station/apply.ts tests/station/applyPlan.test.ts
git commit -m "feat(station): computeApplyPlan — per-project file changes vs last snapshot"
```

---

## Task 11: Apply 执行(I/O 编排)

**Files:** Modify `src/main/station/apply.ts`(加 `executeApply`), Test `tests/station/executeApply.test.ts`

编排:备份所有受影响文件 → 安全合并写入 → 更新并保存 `lastApplied` 快照。时间戳由调用方传入。

- [ ] **Step 1: 写失败测试(临时 home,真写真读)**

```typescript
import { describe, it, expect } from 'vitest';
import { mkdtempSync, writeFileSync, readFileSync, mkdirSync, rmSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { executeApply } from '../../src/main/station/apply';
import { emptyState, saveState, loadState } from '../../src/main/station/store';
import { projectMcpJson, resolvePaths } from '../../src/main/scanner/paths';

describe('executeApply', () => {
  it('writes .mcp.json + local scope, preserves other ~/.claude.json fields, records snapshot', () => {
    const home = mkdtempSync(join(tmpdir(), 'cs-ap-'));
    const proj = join(home, 'proj'); mkdirSync(proj, { recursive: true });
    // 预置 ~/.claude.json 顶层有全局 MCP + lastCost,必须被保留
    writeFileSync(resolvePaths(home).claudeJson, JSON.stringify({
      mcpServers: { globalA: { command: 'g' } },
      projects: { [proj]: { lastCost: 7 } },
    }));
    const s = emptyState();
    s.library.mcp['exa'] = { id: 'exa', def: { command: 'exa' }, hasSecrets: false };
    s.library.mcp['firecrawl'] = { id: 'firecrawl', def: { command: 'npx', env: { K: 'v' } }, hasSecrets: true };
    s.assignments[proj] = { mcp: ['exa', 'firecrawl'] };
    saveState(s, home);

    executeApply(s, [proj], '20260608-010101', home);

    // .mcp.json 写了 exa(不含密钥)
    expect(JSON.parse(readFileSync(projectMcpJson(proj), 'utf8')).mcpServers).toEqual({ exa: { command: 'exa' } });
    // ~/.claude.json: 顶层 globalA 与 lastCost 保留,项目本地写了 firecrawl
    const cj = JSON.parse(readFileSync(resolvePaths(home).claudeJson, 'utf8'));
    expect(cj.mcpServers).toEqual({ globalA: { command: 'g' } });   // 全局 6 个那类:不动
    expect(cj.projects[proj].lastCost).toBe(7);                      // 高频字段保留
    expect(cj.projects[proj].mcpServers).toEqual({ firecrawl: { command: 'npx', env: { K: 'v' } } });
    // 快照已记录并持久化
    const saved = loadState(home);
    expect(saved.lastApplied[proj].mcpJson).toEqual({ exa: { command: 'exa' } });
    expect(saved.lastApplied[proj].localScope).toEqual({ firecrawl: { command: 'npx', env: { K: 'v' } } });
    // 备份目录存在
    expect(existsSync(join(home, '.claude-station', 'backups', '20260608-010101'))).toBe(true);
    rmSync(home, { recursive: true, force: true });
  });
});
```

- [ ] **Step 2: 跑测试确认失败**。

- [ ] **Step 3: 在 apply.ts 追加实现**

```typescript
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { backupFiles } from './backup';
import { compileProjectTargets } from './compile';
import { mergeMcpJson, mergeLocalScope } from './merge';
import { saveState } from './store';

function readJson(file: string): any {
  if (!existsSync(file)) return undefined;
  try { return JSON.parse(readFileSync(file, 'utf8')); } catch { return undefined; }
}

export function executeApply(state: StationState, projectPaths: string[], stamp: string, home: string = homedir()): StationState {
  const claudeJson = resolvePaths(home).claudeJson;
  const plan = computeApplyPlan(state, projectPaths, home);
  if (!plan.changes.length) return state;

  // 1) 备份所有受影响文件(去重)
  backupFiles([...new Set(plan.changes.map(c => c.file))], stamp, home);

  // 2) 写 .mcp.json(逐项目),再写一次 ~/.claude.json(累积所有项目的 local scope)
  let cj = readJson(claudeJson);
  const next = { ...state, lastApplied: { ...state.lastApplied } };
  for (const path of projectPaths) {
    const target = compileProjectTargets(state, path);
    const mcpJsonFile = projectMcpJson(path);
    writeFileSync(mcpJsonFile, JSON.stringify(mergeMcpJson(readJson(mcpJsonFile), target.mcpJson), null, 2));
    cj = mergeLocalScope(cj, path, target.localScope);
    next.lastApplied[path] = { mcpJson: target.mcpJson, localScope: target.localScope };
  }
  writeFileSync(claudeJson, JSON.stringify(cj, null, 2));

  // 3) 持久化快照
  saveState(next, home);
  return next;
}
```

- [ ] **Step 4: 跑测试确认通过**（1 个）。关键断言:`cj.mcpServers`(顶层全局)不变。

- [ ] **Step 5: 跑全部 station 测试** — `npx vitest run tests/station/` 应全绿。

- [ ] **Step 6: Commit**
```bash
git add src/main/station/apply.ts tests/station/executeApply.test.ts
git commit -m "feat(station): executeApply — backup, structural write, snapshot persist"
```

---

## Task 12: station IPC(状态 + 装配 + apply)

**Files:** Modify `src/main/ipc.ts`, Modify `src/preload/index.ts`, Modify `src/renderer/vite-env.d.ts`

新增 IPC,渲染层通过 `window.station` 调用。时间戳在主进程用 `new Date()` 生成(主进程允许)。

- [ ] **Step 1: 改 ipc.ts**

在现有 `registerIpc()` 内追加(保留已有的 `station:getState`):

```typescript
import { ipcMain } from 'electron';
import { homedir } from 'node:os';
import { buildState } from './scanner/buildState';
import { loadState, saveState } from './station/store';
import { seedStateFromInferred } from './station/seed';
import { assignMcp, unassignMcp } from './station/assign';
import { computeApplyPlan, executeApply } from './station/apply';
import { stationPaths } from './station/paths';
import { existsSync } from 'node:fs';

export function registerIpc(): void {
  ipcMain.handle('station:getState', () => buildState());

  // 期望状态:首次用反向导入播种,之后读 state.json
  ipcMain.handle('station:loadDesired', () => {
    const home = homedir();
    if (!existsSync(stationPaths(home).stateFile)) {
      const seeded = seedStateFromInferred(buildState(home));
      saveState(seeded, home);
      return seeded;
    }
    return loadState(home);
  });

  ipcMain.handle('station:assign', (_e, projectPath: string, mcpId: string) => {
    const next = assignMcp(loadState(), projectPath, mcpId);
    saveState(next); return next;
  });
  ipcMain.handle('station:unassign', (_e, projectPath: string, mcpId: string) => {
    const next = unassignMcp(loadState(), projectPath, mcpId);
    saveState(next); return next;
  });

  ipcMain.handle('station:plan', (_e, projectPaths: string[]) =>
    computeApplyPlan(loadState(), projectPaths));

  ipcMain.handle('station:apply', (_e, projectPaths: string[]) => {
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    return executeApply(loadState(), projectPaths, stamp);
  });
}
```

- [ ] **Step 2: 改 preload/index.ts** — 暴露新方法:

```typescript
import { contextBridge, ipcRenderer } from 'electron';
import type { InferredState } from '../main/types';
import type { StationState, ApplyPlan } from '../main/station/types';

contextBridge.exposeInMainWorld('station', {
  getState: (): Promise<InferredState> => ipcRenderer.invoke('station:getState'),
  loadDesired: (): Promise<StationState> => ipcRenderer.invoke('station:loadDesired'),
  assign: (p: string, id: string): Promise<StationState> => ipcRenderer.invoke('station:assign', p, id),
  unassign: (p: string, id: string): Promise<StationState> => ipcRenderer.invoke('station:unassign', p, id),
  plan: (paths: string[]): Promise<ApplyPlan> => ipcRenderer.invoke('station:plan', paths),
  apply: (paths: string[]): Promise<StationState> => ipcRenderer.invoke('station:apply', paths),
});
```

- [ ] **Step 3: 改 vite-env.d.ts** — 同步类型:

```typescript
/// <reference types="vite/client" />
import type { InferredState } from '../main/types';
import type { StationState, ApplyPlan } from '../main/station/types';

declare global {
  interface Window {
    station: {
      getState: () => Promise<InferredState>;
      loadDesired: () => Promise<StationState>;
      assign: (projectPath: string, mcpId: string) => Promise<StationState>;
      unassign: (projectPath: string, mcpId: string) => Promise<StationState>;
      plan: (projectPaths: string[]) => Promise<ApplyPlan>;
      apply: (projectPaths: string[]) => Promise<StationState>;
    };
  }
}
export {};
```

- [ ] **Step 4: tsc 确认** — `npx tsc --noEmit` clean。channel 名在 ipc.ts 与 preload 必须逐字一致。

- [ ] **Step 5: Commit**
```bash
git add src/main/ipc.ts src/preload/index.ts src/renderer/vite-env.d.ts
git commit -m "feat(station): IPC for desired-state load/assign/unassign/plan/apply"
```

---

## Task 13: 左栏库(可拖 chip)

**Files:** Create `src/renderer/rail/LibraryRail.tsx`

用 HTML5 原生拖放(`draggable`),拖动时把 mcp id 放进 `dataTransfer`。复用 M1 视觉(CSS var)。

- [ ] **Step 1: 写组件**

```tsx
import React from 'react';
import type { LibraryMcp } from '../../main/station/types';

export function LibraryRail({ mcp }: { mcp: LibraryMcp[] }) {
  return (
    <aside style={{ width: 200, background: 'var(--bg-rail)', borderRight: '1px solid var(--border)', padding: 16, overflowY: 'auto' }}>
      <div className="serif" style={{ fontSize: 13, fontWeight: 600, marginBottom: 10 }}>MCP 库</div>
      {mcp.length === 0 && <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>—</div>}
      {mcp.map(m => (
        <div key={m.id}
          draggable
          onDragStart={e => { e.dataTransfer.setData('application/x-mcp-id', m.id); e.dataTransfer.effectAllowed = 'copy'; }}
          style={{
            display: 'flex', alignItems: 'center', gap: 6, cursor: 'grab',
            padding: '6px 10px', marginBottom: 6, borderRadius: 8,
            background: 'var(--bg-surface)', border: '1px solid var(--border)', fontSize: 12,
          }}>
          <span style={{ width: 3, height: 14, borderRadius: 2, background: '#D97757' }} />
          {m.id}
          {m.hasSecrets && <span title="含密钥" style={{ marginLeft: 'auto', color: 'var(--text-muted)' }}>🔑</span>}
        </div>
      ))}
    </aside>
  );
}
```

- [ ] **Step 2: tsc 确认** clean。

- [ ] **Step 3: Commit**
```bash
git add src/renderer/rail/LibraryRail.tsx
git commit -m "feat(ui): draggable MCP library rail"
```

---

## Task 14: 项目节点接收 drop + Apply 栏 + diff 模态

**Files:** Modify `src/renderer/canvas/ProjectNode.tsx`, Create `src/renderer/apply/ApplyBar.tsx`, Create `src/renderer/apply/DiffModal.tsx`

- [ ] **Step 1: 改 ProjectNode.tsx 接收 drop**

在最外层 `<div>` 加 drop 处理。`data` 现在需要带一个 `onDropMcp(projectPath, mcpId)` 回调——通过 node data 传入。在现有 ProjectNode 的 `data` 解构与最外层 div 上增加:

```tsx
// data 现在形如 ProjectState & { onDropMcp?: (path: string, mcpId: string) => void }
export function ProjectNode({ data }: NodeProps<any>) {
  const name = data.path.split('/').pop() || data.path;
  const summary = `${data.mcp.length} MCP · ${data.skills.length} skill · ${data.plugins.filter((p: any) => p.enabled).length} plugin`;
  return (
    <div
      onDragOver={e => { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; }}
      onDrop={e => {
        const id = e.dataTransfer.getData('application/x-mcp-id');
        if (id && data.onDropMcp) data.onDropMcp(data.path, id);
      }}
      style={{
        width: 260, background: 'var(--bg-surface)',
        border: '1px solid var(--border)', borderRadius: 12,
        boxShadow: 'var(--shadow)', padding: 16,
      }}>
      <div className="serif" style={{ fontSize: 16, fontWeight: 600 }}>{name}</div>
      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2, marginBottom: 10 }}>{summary}</div>
      <div style={{ display: 'flex', flexWrap: 'wrap' }}>
        {data.mcp.map((m: any) => <CapabilityChip key={'m'+m.id} kind="mcp" label={m.id} hasSecrets={m.hasSecrets} />)}
        {data.skills.map((s: any) => <CapabilityChip key={'s'+s.id} kind="skill" label={s.id} />)}
        {data.plugins.filter((p: any) => p.enabled).map((p: any) => <CapabilityChip key={'p'+p.id} kind="plugin" label={p.id.split('@')[0]} />)}
      </div>
    </div>
  );
}
```
(保留顶部的 `import` 不变。)

- [ ] **Step 2: 写 ApplyBar.tsx**

```tsx
import React from 'react';

export function ApplyBar({ pendingCount, onApply }: { pendingCount: number; onApply: () => void }) {
  return (
    <button onClick={onApply} disabled={pendingCount === 0}
      style={{
        border: 'none', borderRadius: 8, padding: '6px 14px', cursor: pendingCount ? 'pointer' : 'default',
        background: pendingCount ? 'var(--accent)' : 'var(--border)', color: '#fff', fontSize: 13, fontWeight: 500,
      }}>
      Apply{pendingCount ? ` (${pendingCount})` : ''}
    </button>
  );
}
```

- [ ] **Step 3: 写 DiffModal.tsx**

```tsx
import React from 'react';
import type { ApplyPlan } from '../../main/station/types';

export function DiffModal({ plan, onConfirm, onCancel }: {
  plan: ApplyPlan | null; onConfirm: () => void; onCancel: () => void;
}) {
  if (!plan) return null;
  return (
    <div onClick={onCancel} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.35)', display: 'grid', placeItems: 'center', zIndex: 50 }}>
      <div onClick={e => e.stopPropagation()} style={{
        width: 640, maxHeight: '80vh', overflowY: 'auto', background: 'var(--bg-surface)',
        border: '1px solid var(--border)', borderRadius: 12, padding: 20, boxShadow: 'var(--shadow)',
      }}>
        <h2 className="serif" style={{ marginTop: 0, fontSize: 18 }}>待写入更改</h2>
        {plan.changes.length === 0 && <p style={{ color: 'var(--text-muted)' }}>无更改</p>}
        {plan.changes.map((c, i) => (
          <div key={i} style={{ marginBottom: 14 }}>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-muted)', wordBreak: 'break-all' }}>
              {c.kind === 'localscope' ? '本地作用域' : '.mcp.json'} · {c.file}
            </div>
            {c.added.map(id => <div key={'a'+id} style={{ fontSize: 12, color: 'var(--state-applied)' }}>+ {id}</div>)}
            {c.changed.map(id => <div key={'c'+id} style={{ fontSize: 12, color: 'var(--state-pending)' }}>~ {id}</div>)}
            {c.removed.map(id => <div key={'r'+id} style={{ fontSize: 12, color: 'var(--state-drift)' }}>- {id}</div>)}
          </div>
        ))}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
          <button onClick={onCancel} style={{ padding: '6px 14px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-canvas)', color: 'var(--text-primary)', cursor: 'pointer' }}>取消</button>
          <button onClick={onConfirm} disabled={plan.changes.length === 0}
            style={{ padding: '6px 14px', borderRadius: 8, border: 'none', background: 'var(--accent)', color: '#fff', cursor: 'pointer' }}>确认写入</button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: tsc 确认** clean。

- [ ] **Step 5: Commit**
```bash
git add src/renderer/canvas/ProjectNode.tsx src/renderer/apply/ApplyBar.tsx src/renderer/apply/DiffModal.tsx
git commit -m "feat(ui): project drop target + apply bar + diff modal"
```

---

## Task 15: App 集成装配 + Apply 流程

**Files:** Modify `src/renderer/App.tsx`, Modify `src/renderer/canvas/Canvas.tsx`

把 station 期望状态接入,装配走 IPC,Apply 走 plan→DiffModal→apply→重载。

- [ ] **Step 1: Canvas 透传 onDropMcp**

在 `Canvas.tsx` 的 props 加 `onDropMcp`,并塞进每个 node 的 data:

```tsx
export function Canvas({ projects, onSelect, onDropMcp }: {
  projects: ProjectState[];
  onSelect: (p: ProjectState) => void;
  onDropMcp?: (path: string, mcpId: string) => void;
}) {
  const nodes = useMemo(() => projects.map((p, i) => ({
    id: p.path, type: 'project',
    position: { x: (i % 3) * 300 + 40, y: Math.floor(i / 3) * 240 + 40 },
    data: { ...p, onDropMcp },
  })), [projects, onDropMcp]);
  // ...其余不变(ReactFlow 渲染)
```
(其余 ReactFlow JSX 保持 M1 原样。)

- [ ] **Step 2: 改 App.tsx**

```tsx
import React, { useEffect, useState, useCallback } from 'react';
import { Canvas } from './canvas/Canvas';
import { DetailPanel } from './panel/DetailPanel';
import { LibraryRail } from './rail/LibraryRail';
import { ApplyBar } from './apply/ApplyBar';
import { DiffModal } from './apply/DiffModal';
import type { ProjectState } from '../main/types';
import type { StationState, ApplyPlan } from '../main/station/types';

export function App() {
  const [desired, setDesired] = useState<StationState | null>(null);
  const [projects, setProjects] = useState<ProjectState[]>([]);
  const [selected, setSelected] = useState<ProjectState | null>(null);
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const [plan, setPlan] = useState<ApplyPlan | null>(null);

  const reload = useCallback(async () => {
    const [inferred, d] = await Promise.all([window.station.getState(), window.station.loadDesired()]);
    setProjects(inferred.projects);
    setDesired(d);
  }, []);
  useEffect(() => { reload(); }, [reload]);
  useEffect(() => { document.documentElement.setAttribute('data-theme', theme); }, [theme]);

  const onDropMcp = useCallback(async (path: string, mcpId: string) => {
    setDesired(await window.station.assign(path, mcpId));
  }, []);

  const allProjectPaths = projects.map(p => p.path);
  // 待改计数:用一次 plan 估算
  const [pendingCount, setPendingCount] = useState(0);
  useEffect(() => {
    if (!desired) return;
    window.station.plan(allProjectPaths).then(p => setPendingCount(p.changes.length));
  }, [desired]); // eslint-disable-line

  const openDiff = async () => setPlan(await window.station.plan(allProjectPaths));
  const confirmApply = async () => { await window.station.apply(allProjectPaths); setPlan(null); await reload(); };

  const libMcp = desired ? Object.values(desired.library.mcp) : [];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
      <header style={{ height: 44, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 16px', borderBottom: '1px solid var(--border)', background: 'var(--bg-surface)', WebkitUserSelect: 'none' }}>
        <span className="serif" style={{ fontWeight: 600 }}>Claude Station</span>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <ApplyBar pendingCount={pendingCount} onApply={openDiff} />
          <button onClick={() => setTheme(t => t === 'light' ? 'dark' : 'light')}
            style={{ border: '1px solid var(--border)', borderRadius: 8, padding: '4px 10px', background: 'var(--bg-canvas)', color: 'var(--text-primary)', cursor: 'pointer' }}>
            {theme === 'light' ? '🌙 深色' : '☀️ 浅色'}
          </button>
        </div>
      </header>
      <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
        <LibraryRail mcp={libMcp} />
        <Canvas projects={projects} onSelect={setSelected} onDropMcp={onDropMcp} />
        <DetailPanel project={selected} />
      </div>
      <DiffModal plan={plan} onConfirm={confirmApply} onCancel={() => setPlan(null)} />
    </div>
  );
}
```

- [ ] **Step 3: tsc 确认** clean。

- [ ] **Step 4: Commit**
```bash
git add src/renderer/App.tsx src/renderer/canvas/Canvas.tsx
git commit -m "feat(ui): wire assign + apply flow into App"
```

---

## Task 16: 整体验证

**Files:** 无(纯验证)

- [ ] **Step 1: 全单测** — `npx vitest run`。M1 的 16 + M2 station 各任务测试,应全绿。报告总数。

- [ ] **Step 2: 类型** — `npx tsc --noEmit` clean。

- [ ] **Step 3: 构建** — `npm run build` 三产物无 error。

- [ ] **Step 4: 手动验证(人工)** — `npm run dev`:
  - 左栏出现 MCP 库 chip(应见 6 个全局 MCP)。
  - 把一个 chip 拖到某项目卡片 → 顶栏 Apply 计数 +1。
  - 点 Apply → 弹 diff,显示该项目 `.mcp.json`(不含密钥的)或本地作用域(firecrawl 这种含密钥的)的 `+` 行。
  - 确认写入 → 检查该项目真出现 `.mcp.json` 且内容正确;`~/.claude.json` 顶层 6 个全局 MCP **原封不动**(关键安全断言)。
  - `~/.claude-station/backups/<时间戳>/` 有备份。

- [ ] **Step 5: 安全复核(人工)** — Apply 后跑:
  `git -C ~/claude-station diff` 无关文件未被动;手查 `~/.claude.json` 顶层 `mcpServers` 仍是 6 个,`lastCost` 等字段未丢。

---

## 完成标准(M2)

- [ ] 所有 station 纯函数单测 + executeApply 集成测试全绿。
- [ ] `npm run build` 无 error。
- [ ] 拖拽装配 → Apply → 真实写入 `.mcp.json` / 本地作用域,全程备份 + diff 预览。
- [ ] **关键:`~/.claude.json` 顶层 6 个全局 MCP 在 Apply 后原封不动**(全局清理是 M2.5,不在本期)。
- [ ] 漂移检测函数就绪(UI 提示可留到后续)。
