import { env } from "@env";
import openapi from "@elysia/openapi";

export const ScalarPlugin = openapi({
  path: "/docs",
  documentation: {
    info: {
      title: env.APP_NAME,
      version: env.APP_VERSION,
    },
  },
});
