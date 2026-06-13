import React from 'react';
import { motion } from 'motion/react';
import { formatIpcError } from '../ipcError';

interface Props {
  children: React.ReactNode;
  // 「重新加载」时调用——通常触发 App 重扫磁盘配置以修复半更新的坏状态
  onReset?: () => void;
  // 错误卡片标题里显示的区域名(如「画布」),便于用户定位
  label?: string;
  // 外部数据变化的指纹;变化时自动复位 error,无需用户再点「重新加载」
  resetKey?: string;
}

interface State {
  error: Error | null;
}

// React 错误边界只能用 class 组件实现。没有它时,渲染期任何未捕获异常都会
// 卸载整棵 React 树 → 画布全黑、星球全部消失。这里把崩溃限制在被包裹的子树内,
// 并提供可恢复的错误卡片,避免「挂载某个东西就整屏崩溃」。
export class ErrorBoundary extends React.Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    // 保留 component stack 便于排查具体是哪个组件抛错
    console.error('[ErrorBoundary]', this.props.label ?? '', error, info.componentStack);
  }

  componentDidUpdate(prev: Props) {
    // reload 成功后底层数据指纹变化 → 自动复位,卡片消失,无需用户再次点击
    if (this.state.error && prev.resetKey !== this.props.resetKey) {
      this.setState({ error: null });
    }
  }

  private handleReset = () => {
    // 两步缺一不可:只复位 state 而数据仍坏会立即二次崩溃;
    // 只 reload 而不复位 state 则子树不会重新挂载。
    this.setState({ error: null });
    this.props.onReset?.();
  };

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <div style={{ display: 'grid', placeItems: 'center', height: '100%', padding: 24 }}>
        <motion.div
          initial={{ y: -12, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 400, damping: 32 }}
          style={{
            maxWidth: 420, padding: '20px 24px', borderRadius: 16,
            background: 'var(--glass-surface-strong)',
            backdropFilter: 'blur(20px) saturate(180%)',
            WebkitBackdropFilter: 'blur(20px) saturate(180%)',
            border: '1px solid var(--state-drift)',
            boxShadow: 'var(--glass-shadow)',
          }}>
          <h2 className="serif" style={{ margin: '0 0 8px', fontSize: 16, color: 'var(--state-drift)' }}>
            ⚠️ {this.props.label ? `${this.props.label}出错` : '出错了'}
          </h2>
          <p style={{ margin: '0 0 16px', fontSize: 12, lineHeight: 1.6, color: 'var(--text-muted)', whiteSpace: 'pre-wrap' }}>
            {formatIpcError(this.state.error)}
          </p>
          <motion.button
            whileTap={{ scale: 0.96 }}
            transition={{ type: 'spring', stiffness: 500, damping: 30, mass: 0.8 }}
            onClick={this.handleReset}
            style={{
              border: '1px solid var(--border)', borderRadius: 10, padding: '6px 14px',
              background: 'var(--accent)', color: '#fff', cursor: 'pointer', fontSize: 13,
            }}>
            重新加载
          </motion.button>
        </motion.div>
      </div>
    );
  }
}
