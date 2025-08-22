import { Location, Span } from "./span";

export interface ErrorOptions {
  span: Span;
  type: string;
  message: string;
}

export class SourceError extends Error {
  constructor(
    public meta: ErrorOptions,
    public file: SourceFile,
    formatted: string,
  ) {
    super(formatted);
  }
}

export class SourceFile {
  public readonly lines: string[];

  constructor(
    public readonly path: string,
    public readonly content: string,
  ) {
    this.lines = content.split("\n");
  }

  getSpan(): Span {
    return new Span(new Location(0, 0), new Location(this.lines.length, this.lines[this.lines.length - 1].length - 1));
  }

  private format(meta: ErrorOptions): string {
    const { start, end } = meta.span;
    const padding = (end.line + 1).toString().length;
    const empty = " ".repeat(padding);

    let out = "";

    out += ` ${empty} +-- ${meta.type}Error at ${this.path}:${meta.span.start.line + 1}:${meta.span.start.col + 1}\n`;
    out += ` ${empty} |\n`;

    for (let i = start.line; i <= end.line; i++) {
      const line = this.lines[i];
      out += ` ${(i + 1).toString().padStart(padding)} | ${line}\n`;

      if (i === start.line && i === end.line) {
        out += ` ${empty} | ${" ".repeat(start.col)}${"^".repeat(end.col - start.col + 1)}\n`;
      } else if (i === start.line) {
        out += ` ${empty} | ${" ".repeat(start.col)}${"^".repeat(line.length - start.col)}\n`;
      } else if (i === end.line) {
        out += ` ${empty} | ${"^".repeat(end.col)}\n`;
      } else {
        out += ` ${empty} | ${"^".repeat(line.length)}\n`;
      }
    }

    out += ` ${empty} |\n`;
    out += ` ${empty} +-- ${meta.message}`;

    return out;
  }

  error(options: ErrorOptions): never {
    throw new SourceError(options, this, this.format(options));
  }

  static async from(path: string): Promise<SourceFile> {
    return new SourceFile(path, await Bun.file(path).text());
  }
}
