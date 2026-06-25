import { env } from "@env";
import { Elysia } from "elysia";
import { jwt } from "@elysia/jwt";

export const TokenPlugin = new Elysia({ name: "token.plugin" })
  .use(jwt({
    name: "jwt",
    exp: env.ACCESS_TTL,
    secret: env.SECRET_KEY,
  }));
