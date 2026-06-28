import type { Flag } from "@context/engine/flags.aggregate";

export interface IFlagRepository {
  create(flag: Flag): Promise<void>;
  update(flag: Flag): Promise<void>;
  remove(flag: Flag): Promise<void>;
};
