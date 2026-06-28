import type { Flag } from "@prisma/client";
import type { Create, Update, Enable, Disable, Delete } from "./flags.write";

export interface IFlagsDao {
  create(args: Create.Args): Promise<Flag>;
  update(args: Update.Args): Promise<Flag>;
  enable(args: Enable.Args): Promise<Flag>;
  remove(args: Delete.Args): Promise<Flag>;
  disable(args: Disable.Args): Promise<Flag>;
};
