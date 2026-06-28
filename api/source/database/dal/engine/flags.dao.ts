import type { PrismaClient } from "@prisma/client";
import type { IFlagRepository } from "./flags.idao";

import { Flag } from "@context/engine/flags.aggregate";
import { Create, Update, Remove } from "./flags.write";

export class FlagRepository implements IFlagRepository {
  constructor(private readonly db: PrismaClient) {};

  public async create(flag: Flag): Promise<void> {
    await this.db.flag.create(Create.query(flag));
  };

  public async update(flag: Flag): Promise<void> {
    await this.db.flag.update(Update.query(flag));
  };

  public async remove(flag: Flag): Promise<void> {
    await this.db.flag.delete(Remove.query(flag));
  };
};
