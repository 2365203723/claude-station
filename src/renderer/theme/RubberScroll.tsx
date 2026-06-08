import React, { useRef, useCallback } from 'react';
import { motion, useMotionValue, animate } from 'motion/react';
import { springRubber } from '../theme/springs';

// iOS 橡皮筋滚动容器:滚到边缘继续滚时,内容阻尼性拉伸,停手后 spring 弹回。
// 用法:把原本 overflowY:auto 的容器换成 <RubberScroll style={...}>。
export function RubberScroll({ children, style, className }: {
  children: React.ReactNode;
  style?: React.CSSProperties;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const overscroll = useMotionValue(0);   // 当前橡皮筋位移
  const idleTimer = useRef<number | null>(null);

  const settle = useCallback(() => {
    animate(overscroll, 0, springRubber);
  }, [overscroll]);

  const onWheel = useCallback((e: React.WheelEvent<HTMLDivElement>) => {
    const el = ref.current;
    if (!el) return;
    const atTop = el.scrollTop <= 0;
    const atBottom = el.scrollTop + el.clientHeight >= el.scrollHeight - 1;
    const dy = e.deltaY;
    const pulling = (atTop && dy < 0) || (atBottom && dy > 0);

    if (pulling) {
      // 阻尼:位移越大,新增越小(除以衰减系数)
      const cur = overscroll.get();
      const damp = 1 / (1 + Math.abs(cur) / 60);
      const next = cur - dy * 0.35 * damp;
      // 限幅,避免拉太远
      overscroll.set(Math.max(-120, Math.min(120, next)));

      if (idleTimer.current) clearTimeout(idleTimer.current);
      idleTimer.current = window.setTimeout(settle, 90);
    } else if (overscroll.get() !== 0) {
      // 反向滚动,立即收回
      settle();
    }
  }, [overscroll, settle]);

  return (
    <motion.div
      ref={ref}
      className={className}
      onWheel={onWheel}
      style={{ ...style, y: overscroll }}
    >
      {children}
    </motion.div>
  );
}
