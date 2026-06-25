import { env } from "@env";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const connectionString = env.POSTGRES_URL;

const adapter = new PrismaPg(connectionString);
export const Context = new PrismaClient({ adapter });
