import type { Flag } from "@prisma/client";
import type { PrismaClient } from "@prisma/client";
import type { IFlagsDao } from "@features/flags/context/flags.idao";

import { Create } from "@features/flags/shared/queries/create.query";
import { Delete } from "@features/flags/shared/queries/delete.query";
import { Update } from "@features/flags/shared/queries/update.query";
import { Enable } from "@features/flags/shared/queries/enable.query";
import { Disable } from "@features/flags/shared/queries/disable.query";

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
