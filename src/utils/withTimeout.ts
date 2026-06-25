export class TimeoutError extends Error {
  constructor(ms: number, label: string) {
    super(`${label} timed out after ${ms}ms`);
    this.name = "TimeoutError";
  }
}

// Rejects with TimeoutError if the promise doesn't settle within `ms`. The
// underlying work is not cancelled — callers use this to bound how long they
// wait on a slow upstream (AI provider) before falling back.
export function withTimeout<T>(
  promise: Promise<T>,
  ms: number,
  label = "operation",
): Promise<T> {
  let timer: NodeJS.Timeout;
  const timeout = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(() => reject(new TimeoutError(ms, label)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}
