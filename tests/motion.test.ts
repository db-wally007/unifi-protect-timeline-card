import { describe, it, expect } from 'vitest';
import { clipBox, zoomTransform, type Box } from '../src/data/motion';

/** The box `content` (element-relative) lands on under `transform`, for an
 *  element laid out at `at` with transform-origin 0 0. */
function landed(transform: string, at: Box, content: Box): Box {
  const m = /translate\(([-\d.e]+)px, ([-\d.e]+)px\) scale\(([-\d.e]+)\)/.exec(transform)!;
  const [tx, ty, k] = [Number(m[1]), Number(m[2]), Number(m[3])];
  return { x: at.x + tx + k * content.x, y: at.y + ty + k * content.y, w: k * content.w, h: k * content.h };
}

describe('clipBox', () => {
  it('keeps a box wholly inside the view', () => {
    expect(clipBox({ x: 10, y: 20, w: 100, h: 50 }, { x: 0, y: 0, w: 500, h: 500 })).toEqual({ x: 10, y: 20, w: 100, h: 50 });
  });

  it('a tile half scrolled out of its grid: the part still on screen', () => {
    expect(clipBox({ x: 300, y: -100, w: 1157, h: 650 }, { x: 300, y: 100, w: 1157, h: 800 })).toEqual({ x: 300, y: 100, w: 1157, h: 450 });
  });

  it('none of it on screen: null', () => {
    expect(clipBox({ x: 300, y: -800, w: 1157, h: 650 }, { x: 300, y: 100, w: 1157, h: 800 })).toBeNull();
  });
});

describe('zoomTransform', () => {
  const at: Box = { x: 256, y: 0, w: 1207, h: 914 };

  it('fits the content inside the source, centred, at one uniform scale', () => {
    const src: Box = { x: 40, y: 300, w: 145, h: 91 };
    const content: Box = { x: 0, y: 0, w: 1207, h: 914 };
    const b = landed(zoomTransform(src, at, content), at, content);
    expect(b.h).toBeCloseTo(91); // the taller side binds
    expect(b.w).toBeLessThanOrEqual(145 + 1e-6);
    expect(b.w / b.h).toBeCloseTo(1207 / 914);
    expect(b.x + b.w / 2).toBeCloseTo(src.x + src.w / 2);
    expect(b.y + b.h / 2).toBeCloseTo(src.y + src.h / 2);
  });

  it('a picture onto the same picture lands exactly (a clip handed off)', () => {
    const src: Box = { x: 600, y: 80, w: 640, h: 360 };
    const content: Box = { x: 0, y: 117.53125, w: 1207, h: 678.9375 };
    const b = landed(zoomTransform(src, at, content), at, content);
    expect(b.x).toBeCloseTo(600);
    expect(b.y).toBeCloseTo(80);
    expect(b.w).toBeCloseTo(640);
    expect(b.h).toBeCloseTo(360);
  });
});
