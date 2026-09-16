import Lenis from "lenis";

type VirtualScrollData = {
  deltaX: number;
  deltaY: number;
  event: WheelEvent | TouchEvent;
};

let lenis: Lenis | null = null;
let interceptor: ((data: VirtualScrollData) => boolean) | null = null;

export function getLenis(): Lenis | null {
  return lenis;
}

export function setVirtualScrollInterceptor(
  fn: (data: VirtualScrollData) => boolean
): void {
  interceptor = fn;
}

function syncAfterSwap(): void {
  requestAnimationFrame(() => {
    lenis?.resize();
    lenis?.scrollTo(0, { immediate: true });
  });
}

function initSmoothScroll(): void {
  if (lenis) return;

  lenis = new Lenis({
    autoRaf: true,
    smoothWheel: true,
    anchors: false,
    stopInertiaOnNavigate: true,
    respectReducedMotion: true,
    virtualScroll: data => interceptor?.(data) ?? true,
  });

  document.addEventListener("astro:after-swap", syncAfterSwap);
}

initSmoothScroll();
