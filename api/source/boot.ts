import { env } from "@env";
import { Elysia } from "elysia";

import { TokenPlugin } from "@plugins/token.plugin";
import { ScalarPlugin } from "@plugins/scalar.plugin";
import { HealthPlugin } from "@plugins/health.plugin";
import { OriginsPlugin } from "@plugins/origins.plugin";

import { PrismaWire } from "@database/prisma.wiring";

const app = new Elysia({ prefix: "/api" })
  .use(OriginsPlugin)
  .use(ScalarPlugin)
  .use(HealthPlugin)
  .use(TokenPlugin)
  .use(PrismaWire)
  .listen(env.APP_PORT);

const url = `http://${app.server?.hostname}:${app.server?.port}`;
console.log(`🦊 Elysia is running at ${url}`);
