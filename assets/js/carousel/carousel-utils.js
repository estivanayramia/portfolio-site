/**
 * Shared utilities for carousel components.
 * @module carousel-utils
 */

/**
 * @param {number} value
 * @param {number} min
 * @param {number} max
 */
export function clamp(value, min, max) {
  const v = Number(value);
  const lo = Number(min);
  const hi = Number(max);
  if (!Number.isFinite(v)) return lo;
  return Math.max(lo, Math.min(hi, v));
}

/**
 * @template {(...args: any[]) => any} T
 * @param {T} fn
 * @param {number} waitMs
 * @returns {T}
 */
export function debounce(fn, waitMs) {
  /** @type {ReturnType<typeof setTimeout> | null} */
  let t = null;

  // @ts-expect-error - preserve original signature
  return function debounced(...args) {
    if (t) clearTimeout(t);
    t = setTimeout(() => {
      t = null;
      fn.apply(this, args);
    }, Math.max(0, Number(waitMs) || 0));
  };
}

/**
 * Safe matchMedia wrapper.
 * @param {string} query
 */
export function safeMatchMedia(query) {
  try {
    return window.matchMedia ? window.matchMedia(String(query)) : { matches: false };
  } catch {
    return { matches: false };
  }
}

export function prefersReducedMotion() {
  return safeMatchMedia('(prefers-reduced-motion: reduce)').matches;
}

export function supports3D() {
  try {
    return (
      typeof CSS !== 'undefined' &&
      typeof CSS.supports === 'function' &&
      (CSS.supports('transform-style: preserve-3d') || CSS.supports('perspective: 1px'))
    );
  } catch {
    return false;
  }
}

/**
 * Center a child element within a scroll container on the x-axis.
 * @param {HTMLElement} container
 * @param {HTMLElement} child
 * @param {"auto" | "smooth"} behavior
 */
export function scrollChildIntoCenter(container, child, behavior) {
  if (!container || !child) return;

  const reduce = prefersReducedMotion();
  const b = reduce ? 'auto' : behavior;

  try {
    const c = container.getBoundingClientRect();
    const r = child.getBoundingClientRect();

    const containerCenter = c.left + c.width / 2;
    const childCenter = r.left + r.width / 2;
    const delta = childCenter - containerCenter;

    container.scrollBy({ left: delta, behavior: b });
  } catch {
    try {
      child.scrollIntoView({ behavior: b, inline: 'center', block: 'nearest' });
    } catch {}
  }
}

/**
 * Tiny haptic helper.
 * @param {number} ms
 */
export function haptic(ms = 10) {
  try {
    if ('vibrate' in navigator && typeof navigator.vibrate === 'function') {
      navigator.vibrate(Math.max(0, Number(ms) || 0));
    }
  } catch {}
}

