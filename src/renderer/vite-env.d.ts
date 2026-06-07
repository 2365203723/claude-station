/// <reference types="vite/client" />
import type { InferredState } from '../main/types';

declare global {
  interface Window {
    station: { getState: () => Promise<InferredState> };
  }
}
export {};
