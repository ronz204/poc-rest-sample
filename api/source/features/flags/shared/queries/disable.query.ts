import type { FlagUpdateArgs } from "@prisma/models";

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
