import type { PluginCapability } from '../types';

export function parsePlugins(
  installed: any,
  enabledPlugins: Record<string, boolean> | undefined,
): PluginCapability[] {
  const plugins = installed?.plugins ?? {};
  // 若无 settings 显式声明 enabledPlugins,则默认全部启用
  if (!enabledPlugins) return Object.keys(plugins).map(id => ({ id, enabled: true }));
  return Object.keys(plugins).map(id => ({ id, enabled: enabledPlugins[id] === true }));
}
