import { Flag } from "@context/engine/flags.aggregate";
import type { FlagCreateArgs } from "@prisma/models";
import type { FlagUpdateArgs } from "@prisma/models";
import type { FlagDeleteArgs } from "@prisma/models";

export namespace Create {
  export function query(flag: Flag) {
    const args = flag.primitives();
    return {
      data: {
        key: args.key,
        name: args.name,
        short: args.short,
      },
    } satisfies FlagCreateArgs;
  };
};

export namespace Update {
  export function query(flag: Flag) {
    const args = flag.primitives();
    return {
      where: { key: args.key },
      data: {
        name: args.name,
        short: args.short,
        default: args.default,
        enabled: args.enabled,
      },
    } satisfies FlagUpdateArgs;
  };
};

export namespace Remove {
  export function query(flag: Flag) {
    const args = flag.primitives();
    return {
      where: { key: args.key },
    } satisfies FlagDeleteArgs;
  };
};
