import { env } from "@env";
import { jwt } from "@elysia/jwt";

export const TokenPlugin = jwt({
  name: "token.plugin",
  exp: env.ACCESS_TTL,
  iss: env.APP_DOMAIN,
  aud: env.APP_AUDIENCE,
  secret: env.SECRET_KEY,
});
