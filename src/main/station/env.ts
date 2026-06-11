import type { StationState } from './types';

// 更新 MCP 的 env,重新计算 hasSecrets
export function updateMcpEnv(
  state: StationState,
  mcpId: string,
  env: Record<string, string>,
): StationState {
  const entry = state.library.mcp[mcpId];
  if (!entry) return state;

  const hasSecrets = Object.values(env).some(v => typeof v === 'string' && v.length > 0);
  const newDef = { ...entry.def, env };

  const nextLibrary = {
    ...state.library,
    mcp: {
      ...state.library.mcp,
      [mcpId]: { ...entry, def: newDef, hasSecrets },
    },
  };

  // 如果 hasSecrets 变化,所有 lastApplied 快照中的 mcpJson/localScope 路由可能变化,
  // 但快照本身只记录 def map,不会因为路由变化而漂移——下次 apply 会重新计算路由。
  // 这里只更新 library,下一次 computeApplyPlan 会反映 env 变化。

  return { ...state, library: nextLibrary };
}

// 掩码显示用:仅保留前 3 个字符 + "…"
export function maskEnvValue(value: string): string {
  if (value.length <= 3) return '•••';
  return value.slice(0, 3) + '…';
}
