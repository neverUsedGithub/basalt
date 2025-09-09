import { object, string, literal, array, type infer as Infer, number } from "@justcoding123/minitype";
import { readFile } from "fs/promises";
import * as TOML from "smol-toml";
import { join } from "path";
import { Err, Ok, type Result } from "./result";

const projectSchema = object({
  plot: object({
    rank: literal("none"),
    size: number(),
  }),
});

export type Project = Infer<typeof projectSchema>;

export async function loadProject(directory: string): Promise<Result<Project, string>> {
  let file;

  try {
    file = await readFile(join(directory, "basalt.toml"), { encoding: "utf-8" });
  } catch {
    return Err(`error while reading basalt.toml`);
  }

  const result = projectSchema.safeParse(TOML.parse(file));
  if (result.success) return Ok(result.data);

  const path = ["<basalt.toml>", ...result.error.path];
  return Err(`couldn't parse basalt.toml, due to: ${result.error.error}, at ${path.join(".")}`);
}
