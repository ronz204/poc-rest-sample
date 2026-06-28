import type { FlagDeleteArgs } from "@prisma/models";

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
