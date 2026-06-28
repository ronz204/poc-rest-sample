import { Elysia } from "elysia";
import { Context } from "./prisma.context";
import { FlagsDao } from "./dal/engine/flags.dao";

export const PrismaWire = new Elysia({ name: "prisma.wiring" })
  .decorate(() => ({
    flagsDao: new FlagsDao(Context)
  }));
