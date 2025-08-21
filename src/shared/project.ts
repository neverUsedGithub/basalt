import { object, string, literal, array, type infer as Infer, number } from "@justcoding123/minitype";
import logger from "@justcoding123/logger";
import * as TOML from "smol-toml";
import { join } from "path";

const projectSchema = object({
  plot: object({
    rank: literal("none"),
    size: number(),
  }),
});

export type Project = Infer<typeof projectSchema>;

export async function loadProject(directory: string): Promise<Project> {
  const file = Bun.file(join(directory, "basalt.toml"));
  const result = projectSchema.safeParse(TOML.parse(await file.text()));

  if (result.success) return result.data;

  const path = ["<basalt.toml>", ...result.error.path];

  logger.fail(`Failed to parse basalt.toml, due to: ${result.error.error}, at ${path.join(".")}`);
  process.exit(1);
}
