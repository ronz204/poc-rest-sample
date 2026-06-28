export type FlagError =
  | { type: "INVALID_FLAG_KEY"; key: string; }
  | { type: "INVALID_FLAG_NAME"; name: string; }
  | { type: "INVALID_FLAG_SHORT"; short: string; };

export const FlagErrors = Object.freeze({
  invalidKey: (key: string): FlagError => ({ type: "INVALID_FLAG_KEY", key }),
  invalidName: (name: string): FlagError => ({ type: "INVALID_FLAG_NAME", name }),
  invalidShort: (short: string): FlagError => ({ type: "INVALID_FLAG_SHORT", short }),
});