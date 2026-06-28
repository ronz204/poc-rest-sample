import type { IFlagsDao } from "./flags.idao";
import type { PrismaClient } from "@prisma/client";

export class FlagsDao implements IFlagsDao {
  constructor(private readonly db: PrismaClient) {};

  public async create(args: any): Promise<void> {
    
  };
};
