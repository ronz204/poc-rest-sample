import type { FlagFindUniqueArgs, FlagFindManyArgs } from "@prisma/models";

export namespace Unique {
  export function query(key: string) {
    return {
      where: { key },
    } satisfies FlagFindUniqueArgs;
  };
};

export namespace Collect {
  export interface Args {
    page?: number;
    limit?: number;
  };

  export function query(args: Args = {}) {
    const { page = 1, limit = 20 } = args;
    return {
      skip: (page - 1) * limit, take: limit
    } satisfies FlagFindManyArgs;
  };
};
