import { env } from "@env";
import cors from "@elysia/cors";

export const OriginsExtension = cors({
  origin: env.CORS_ORIGIN,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
});
