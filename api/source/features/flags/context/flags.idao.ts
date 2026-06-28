import type { Flag } from "@prisma/client";

import { Create } from "../shared/queries/create.query";
import { Update } from "../shared/queries/update.query";
import { Delete } from "../shared/queries/delete.query";
import { Enable } from "../shared/queries/enable.query";
import { Disable } from "../shared/queries/disable.query";

export interface IFlagsDao {
  create(args: Create.Args): Promise<Flag>;
  update(args: Update.Args): Promise<Flag>;
  enable(args: Enable.Args): Promise<Flag>;
  disable(args: Disable.Args): Promise<Flag>;
  remove(args: Delete.Args): Promise<Flag>;
};
