import { Flag } from "@context/engine/flags.aggregate";
import type { FlagCreateArgs } from "@prisma/models";
import type { FlagUpdateArgs } from "@prisma/models";
import type { FlagDeleteArgs } from "@prisma/models";

export namespace Create {
  export function query(flag: Flag) {
    return {
      data: {
        id: flag.id,
        key: flag.key,
        name: flag.name,
        short: flag.short,
      },
    } satisfies FlagCreateArgs;
  };
};

export namespace Update {
  export function query(flag: Flag) {
    return {
      where: { key: flag.key },
      data: {
        name: flag.name,
        short: flag.short,
        default: flag.default,
        enabled: flag.enabled,
      },
    } satisfies FlagUpdateArgs;
  };
};

export namespace Remove {
  export function query(flag: Flag) {
    return {
      where: { key: flag.key },
    } satisfies FlagDeleteArgs;
  };
};
