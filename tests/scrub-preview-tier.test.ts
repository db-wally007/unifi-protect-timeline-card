import { describe, expect, it } from 'vitest';
import { spriteVariantOrder } from '../src/data/scrub-preview';

describe('spriteVariantOrder', () => {
  it('prefers compact atlases during fast movement', () => {
    expect(spriteVariantOrder(true, true, true)).toEqual(['fast', 'fine']);
  });

  it('prefers fine sheets after movement slows', () => {
    expect(spriteVariantOrder(false, true, true)).toEqual(['fine', 'fast']);
  });

  it('falls back to whichever atlas exists', () => {
    expect(spriteVariantOrder(true, true, false)).toEqual(['fine']);
    expect(spriteVariantOrder(false, false, true)).toEqual(['fast']);
    expect(spriteVariantOrder(false, false, false)).toEqual([]);
  });
});
