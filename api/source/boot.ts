import { env } from "@env";
import { Elysia } from "elysia";

import { ScalarExtension } from "@infra/extensions/scalar.extension";
import { HealthExtension } from "@infra/extensions/health.extension";
import { OriginsExtension } from "@infra/extensions/origins.extension";

const app = new Elysia({ prefix: "/api" })
  .use(OriginsExtension)
  .use(HealthExtension)
  .use(ScalarExtension)
  .listen(env.APP_PORT);

const url = `http://${app.server?.hostname}:${app.server?.port}`;
console.log(`🦊 Elysia is running at ${url}`);
