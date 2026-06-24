import { env } from "@env";
import { Elysia } from "elysia";

export const HealthExtension = new Elysia({ name: "health.plugin" })
  .get("/health", () => ({ service: env.APP_NAME, status: "healthy" }));
