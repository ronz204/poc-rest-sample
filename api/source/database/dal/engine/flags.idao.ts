import type { Flag } from "@context/engine/flags.aggregate";

export interface IFlagsDao {
  create(flag: Flag): Promise<Flag>;
  update(flag: Flag): Promise<Flag>;
  remove(flag: Flag): Promise<Flag>;

  unique(key: string): Promise<Flag | null>;
  collect(): Promise<Flag[]>;
};
