import type { FlagCreateArgs, FlagUpdateArgs, FlagDeleteArgs } from "@prisma/models";

// ─── Create ──────────────────────────────────────────────────────────────────
// Registers a new flag. Always starts disabled — enabling is a separate step.

export namespace Create {
  export interface Args {
    key: string;
    name: string;
    short: string;
  };

  export function query(args: Args) {
    return {
      data: {
        key: args.key,
        name: args.name,
        short: args.short,
      },
    } satisfies FlagCreateArgs;
  };
};

// ─── Update ──────────────────────────────────────────────────────────────────
// Updates editable metadata. Key is immutable — not accepted here.

export namespace Update {
  export interface Args {
    key: string;
    name?: string;
    short?: string;
    default?: boolean;
  };

  export function query(args: Args) {
    return {
      where: { key: args.key },
      data: {
        name: args.name,
        short: args.short,
        default: args.default,
      },
    } satisfies FlagUpdateArgs;
  };
};

// ─── Toggle state ────────────────────────────────────────────────────────────
// The kill switch. Separate from Update so the intent is explicit in logs.

export namespace Enable {
  export interface Args {
    key: string;
  };

  export function query(args: Args) {
    return {
      where: { key: args.key },
      data: { enabled: true },
    } satisfies FlagUpdateArgs;
  };
};

export namespace Disable {
  export interface Args {
    key: string;
  };

  export function query(args: Args) {
    return {
      where: { key: args.key },
      data: { enabled: false },
    } satisfies FlagUpdateArgs;
  };
};

// ─── Delete ──────────────────────────────────────────────────────────────────
// Cascades to rules automatically via FK onDelete. Segments are untouched.

export namespace Delete {
  export interface Args {
    key: string;
  };

  export function query(args: Args) {
    return {
      where: { key: args.key },
    } satisfies FlagDeleteArgs;
  };
};
