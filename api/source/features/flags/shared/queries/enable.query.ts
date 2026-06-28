import type { FlagUpdateArgs } from "@prisma/models";

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
