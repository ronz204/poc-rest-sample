import { Elysia } from "elysia";
import { Context } from "./prisma.context";
import { FlagsDao } from "./dal/flags.dao";

export const PrismaWire = new Elysia({ name: "prisma.wire" })
  .decorate(() => ({
    flagsDao: new FlagsDao(Context),
  }));
