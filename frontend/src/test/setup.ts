import "@testing-library/jest-dom/vitest";

// jsdom 不实现 PointerEvent 构造器，React 因此不注册 pointer 事件处理器。
// 测试中需要驱动 brush/十字光标等 pointer 交互，这里补充一个最小 polyfill。
if (typeof window !== "undefined" && !window.PointerEvent) {
  class PointerEventPolyfill extends MouseEvent {
    pointerId: number;
    pointerType: string;
    constructor(type: string, params: PointerEventInit = {}) {
      super(type, params);
      this.pointerId = params.pointerId ?? 0;
      this.pointerType = params.pointerType ?? "mouse";
    }
  }
  (window as unknown as { PointerEvent: unknown }).PointerEvent = PointerEventPolyfill;
}
