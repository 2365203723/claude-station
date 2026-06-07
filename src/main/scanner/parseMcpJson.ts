import { readFileSync, existsSync } from 'node:fs';
import type { McpCapability, McpServerDef } from '../types';

function hasSecrets(def: McpServerDef): boolean {
  return !!def.env && Object.values(def.env).some(v => typeof v === 'string' && v.length > 0);
}

export function parseMcpJson(filePath: string): McpCapability[] {
  if (!existsSync(filePath)) return [];
  let raw: any;
  try {
    raw = JSON.parse(readFileSync(filePath, 'utf8'));
  } catch {
    return [];
  }
  const servers: Record<string, McpServerDef> = raw?.mcpServers ?? {};
  return Object.entries(servers).map(([id, def]) => ({
    id, scope: 'project-mcpjson' as const, def, hasSecrets: hasSecrets(def),
  }));
}
