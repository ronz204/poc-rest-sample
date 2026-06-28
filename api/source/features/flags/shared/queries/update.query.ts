import type { FlagUpdateArgs } from "@prisma/models";

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
