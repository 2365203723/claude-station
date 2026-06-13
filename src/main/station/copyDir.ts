import { existsSync, mkdirSync, readdirSync, lstatSync, copyFileSync, symlinkSync, readlinkSync, rmSync, realpathSync } from 'node:fs';
import { join } from 'node:path';

/** 递归复制目录,逐项处理——绕开 node cpSync 在某些 macOS 文件系统上
 *  对 `equivalent` 检查抛 "Operation not supported" 的 bug。
 *  symlink 原样复制(verbatim),不解引用。 */
export function copyDirSafe(src: string, dest: string): void {
  // 自我复制守卫:src 与 dest 解析真实路径后相同(例如 src 是指向 dest 的 symlink)时,
  // 下面的 rmSync(dest) 会先删掉真身、再从已空的源复制 → 自我清空。直接跳过。
  try { if (realpathSync(src) === realpathSync(dest)) return; } catch { /* 任一不存在则照常复制 */ }
  // lstat 检测:坏死 symlink 时 existsSync 返回 false,直接 mkdir 会撞 ELOOP
  try { lstatSync(dest); rmSync(dest, { recursive: true, force: true }); } catch { /* 不存在 */ }
  mkdirSync(dest, { recursive: true });
  for (const entry of readdirSync(src, { withFileTypes: true })) {
    const s = join(src, entry.name);
    const d = join(dest, entry.name);
    let st;
    try { st = lstatSync(s); } catch { continue; }
    if (st.isSymbolicLink()) {
      try { symlinkSync(readlinkSync(s), d); } catch { /* 跳过损坏链接 */ }
    } else if (st.isDirectory()) {
      copyDirSafe(s, d);
    } else if (st.isFile()) {
      copyFileSync(s, d);
    }
    // 设备/管道等特殊文件直接跳过
  }
}
