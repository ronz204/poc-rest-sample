import type { Flag } from "@prisma/client";
import type { PrismaClient } from "@prisma/client";
import type { IFlagsDao } from "./flags.idao";

import { Create, Update, Enable, Disable, Delete } from "./flags.write";

export class FlagsDao implements IFlagsDao {
  constructor(private readonly db: PrismaClient) {};

  public async create(args: Create.Args): Promise<Flag> {
    return await this.db.flag.create(Create.query(args));
  };

  public async update(args: Update.Args): Promise<Flag> {
    return await this.db.flag.update(Update.query(args));
  };

  public async enable(args: Enable.Args): Promise<Flag> {
    return await this.db.flag.update(Enable.query(args));
  };

  public async disable(args: Disable.Args): Promise<Flag> {
    return await this.db.flag.update(Disable.query(args));
  };

  public async remove(args: Delete.Args): Promise<Flag> {
    return await this.db.flag.delete(Delete.query(args));
  };
};
