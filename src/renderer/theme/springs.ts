// 统一的 iOS 手感 spring 预设 —— 全局动效引用这里,保证一致
import type { Transition } from 'motion/react';

// 平滑、几乎不回弹:系统级弹窗、面板入场
export const springSmooth: Transition = { type: 'spring', stiffness: 420, damping: 28, mass: 0.9 };
// 脆、快速反馈:按钮/chip 点按
export const springSnappy: Transition = { type: 'spring', stiffness: 500, damping: 30, mass: 0.8 };
// 带轻微回弹:卫星着陆、强调元素
export const springBouncy: Transition = { type: 'spring', stiffness: 460, damping: 22, mass: 0.8 };
// 橡皮筋回弹:滚动到边缘拉伸后弹回
export const springRubber: Transition = { type: 'spring', stiffness: 380, damping: 30, mass: 0.7 };
