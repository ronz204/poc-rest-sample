import type { Flag } from "@context/engine/flags.aggregate";
import { Collect } from "./flags.read";

export interface IFlagsDao {
  create(flag: Flag): Promise<Flag>;
  update(flag: Flag): Promise<Flag>;
  remove(flag: Flag): Promise<Flag>;

  unique(key: string): Promise<Flag | null>;
  collect(args: Collect.Args): Promise<Flag[]>;
};
