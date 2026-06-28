export type Result<T, E> =
  | { ok: true; value: T }
  | { ok: false; error: E };

export const Success = <T>(value: T): Result<T, never> => ({ ok: true, value });
export const Failure = <E>(error: E): Result<never, E> => ({ ok: false, error });
