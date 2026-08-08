type TimerHandle = unknown;

type Schedule = (callback: () => void, delayMs: number) => TimerHandle;
type Cancel = (handle: TimerHandle) => void;

export class LatestValueScheduler<T> {
  private _hasPending = false;
  private _pending?: T;
  private _timer?: TimerHandle;
  private _lastEmitAt = Number.NEGATIVE_INFINITY;

  constructor(
    private readonly _intervalMs: number,
    private readonly _emit: (value: T) => void,
    private readonly _now: () => number = () => performance.now(),
    private readonly _schedule: Schedule = (callback, delayMs) =>
      setTimeout(callback, delayMs),
    private readonly _cancel: Cancel = (handle) =>
      clearTimeout(handle as ReturnType<typeof setTimeout>),
  ) {}

  push(value: T): void {
    this._pending = value;
    this._hasPending = true;
    const remaining = this._intervalMs - (this._now() - this._lastEmitAt);
    if (remaining <= 0) {
      this._emitPending();
    } else if (this._timer === undefined) {
      this._timer = this._schedule(() => {
        this._timer = undefined;
        this._emitPending();
      }, remaining);
    }
  }

  flush(value?: T): void {
    if (arguments.length) {
      this._pending = value;
      this._hasPending = true;
    }
    if (this._timer !== undefined) this._cancel(this._timer);
    this._timer = undefined;
    this._emitPending();
  }

  reset(): void {
    if (this._timer !== undefined) this._cancel(this._timer);
    this._timer = undefined;
    this._pending = undefined;
    this._hasPending = false;
    this._lastEmitAt = Number.NEGATIVE_INFINITY;
  }

  private _emitPending(): void {
    if (!this._hasPending) return;
    const value = this._pending as T;
    this._pending = undefined;
    this._hasPending = false;
    this._lastEmitAt = this._now();
    this._emit(value);
  }
}
