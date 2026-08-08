import { describe, expect, it } from 'vitest';
import { LatestValueScheduler } from '../src/data/latest-value-scheduler';

describe('LatestValueScheduler', () => {
  it('emits immediately, then coalesces rapid values to the latest one', () => {
    let now = 0;
    let scheduled: (() => void) | undefined;
    const emitted: number[] = [];
    const scheduler = new LatestValueScheduler(
      50,
      (value: number) => emitted.push(value),
      () => now,
      (callback) => {
        scheduled = callback;
        return callback;
      },
      () => {
        scheduled = undefined;
      },
    );

    scheduler.push(1);
    now = 10;
    scheduler.push(2);
    now = 20;
    scheduler.push(3);

    expect(emitted).toEqual([1]);
    now = 50;
    scheduled?.();
    expect(emitted).toEqual([1, 3]);
  });

  it('flushes the final value synchronously and resets the first-emission window', () => {
    let now = 0;
    let scheduled: (() => void) | undefined;
    const emitted: number[] = [];
    const scheduler = new LatestValueScheduler(
      50,
      (value: number) => emitted.push(value),
      () => now,
      (callback) => {
        scheduled = callback;
        return callback;
      },
      () => {
        scheduled = undefined;
      },
    );

    scheduler.push(1);
    now = 10;
    scheduler.push(2);
    scheduler.flush(4);
    expect(emitted).toEqual([1, 4]);
    expect(scheduled).toBeUndefined();

    scheduler.reset();
    now = 11;
    scheduler.push(5);
    expect(emitted).toEqual([1, 4, 5]);
  });
});
