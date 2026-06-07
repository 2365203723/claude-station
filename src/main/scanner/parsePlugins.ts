import type { PluginCapability } from '../types';

export function parsePlugins(
  installed: any,
  enabledPlugins: Record<string, boolean> | undefined,
): PluginCapability[] {
  const plugins = installed?.plugins ?? {};
  const enabled = enabledPlugins ?? {};
  return Object.keys(plugins).map(id => ({ id, enabled: enabled[id] === true }));
}
