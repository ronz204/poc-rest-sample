import type { IFlagsDao } from "./flags.idao";
import type { PrismaClient } from "@prisma/client";

import { Flag } from "@context/engine/flags.aggregate";
import { Create, Update, Remove } from "./flags.write";
import { Unique, Collect } from "./flags.read";

export class FlagsDao implements IFlagsDao {
  constructor(private readonly db: PrismaClient) {};

  public async create(flag: Flag): Promise<Flag> {
    const row = await this.db.flag.create(Create.query(flag));
    return Flag.hydrate(row);
  };

  public async update(flag: Flag): Promise<Flag> {
    const row = await this.db.flag.update(Update.query(flag));
    return Flag.hydrate(row);
  };

  public async remove(flag: Flag): Promise<Flag> {
    const row = await this.db.flag.delete(Remove.query(flag));
    return Flag.hydrate(row);
  };

  public async unique(key: string): Promise<Flag | null> {
    const row = await this.db.flag.findUnique(Unique.query(key));
    return row ? Flag.hydrate(row) : null;
  };

  public async collect(): Promise<Flag[]> {
    const rows = await this.db.flag.findMany(Collect.query());
    return rows.map((row) => Flag.hydrate(row));
  };
};
