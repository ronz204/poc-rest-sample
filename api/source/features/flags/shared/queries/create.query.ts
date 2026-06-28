import type { FlagCreateArgs } from "@prisma/models";

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
