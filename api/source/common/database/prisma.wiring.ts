import { Elysia } from "elysia";
import { Context } from "./prisma.context";

export const PrismaWire = new Elysia({ name: "prisma.wire" })
  .decorate(() => ({ ctx: Context }));
