/**
 * HUKM — Outbound-fetch deadline helper.
 *
 * Combines an optional caller signal (e.g. the incoming request's abort)
 * with a hard millisecond deadline into one AbortSignal, without relying
 * on `AbortSignal.any` (Node >= 20) so it runs on Node 18 runtimes.
 *
 * Usage:
 *   const d = withDeadline(45_000, request.signal);
 *   try {
 *     const res = await fetch(url, { signal: d.signal });
 *     …
 *   } finally {
 *     d.cancel();
 *   }
 *
 * On failure, distinguish deadline breaches from user cancels via
 * `d.timedOut` — do NOT infer from the error alone (an AbortError is
 * ambiguous between the two).
 */

export interface Deadline {
  /** Combined abort signal to hand to fetch(). */
  readonly signal: AbortSignal;
  /** True once THIS helper's timer fired (caller signal may also be aborted). */
  readonly timedOut: boolean;
  /** Stop the timer and detach listeners. Always call in finally. */
  cancel(): void;
}

export function withDeadline(ms: number, userSignal?: AbortSignal | null): Deadline {
  const controller = new AbortController();
  let fired = false;

  const timer = setTimeout(() => {
    fired = true;
    controller.abort();
  }, Math.max(0, ms));

  const onUserAbort = (): void => {
    controller.abort();
  };

  if (userSignal) {
    if (userSignal.aborted) {
      controller.abort();
    } else {
      userSignal.addEventListener("abort", onUserAbort, { once: true });
    }
  }

  return {
    signal: controller.signal,
    get timedOut(): boolean {
      return fired;
    },
    cancel(): void {
      clearTimeout(timer);
      userSignal?.removeEventListener("abort", onUserAbort);
    },
  };
}

/**
 * True when `err` came from a deadline breach rather than a caller abort.
 */
export function isDeadlineBreach(
  err: unknown,
  deadline?: Deadline,
  userSignal?: AbortSignal | null,
): boolean {
  if (!deadline) return false;
  return deadline.timedOut && !(userSignal?.aborted ?? false);
}
