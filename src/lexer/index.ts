import type { VariableScope } from "../typechecker";
import type { ErrorOptions, SourceFile } from "../shared/source";
import { Location, Span } from "../shared/span";
import { builtins } from "../standard";

export enum TokenType {
  EOF = "EOF",
  COLON = "COLON",
  COMMA = "COMMA",
  SCOPE = "SCOPE",
  NUMBER = "NUMBER",
  STRING = "STRING",
  TARGET = "TARGET",
  KEYWORD = "KEYWORD",
  BUILTIN = "BUILTIN",
  NEWLINE = "NEWLINE",
  OPERATOR = "OPERATOR",
  TYPENAME = "TYPENAME",
  DELIMITER = "DELIMITER",
  SEMICOLON = "SEMICOLON",
  IDENTIFIER = "IDENITIFIER",
  STYLED_TEXT = "STYLED TEXT",
}

export class Token<T extends TokenType = TokenType> {
  constructor(
    public type: T,
    public value: string,
    public span: Span,
  ) {}
}

const IDENTIFIER_PREFIX_REGEX = /[A-Za-z_]/;
const IDENTIFIER_SUFFIX_REGEX = /[A-Za-z_0-9]/;

function isNumeric(char: string) {
  return !isNaN(Number(char)) || !isNaN(parseFloat(char));
}

const KEYWORDS = [
  "event",
  "let",
  "true",
  "false",
  "using",
  "ref",
  "fn",
  "return",
  "if",
  "player",
  "entity",
  "game",
  "variable",
  "repeat",
  "for",
  "in",
  "to",
];
const TARGETS = [
  "default",
  "all_players",
  "all_entities",
  "selection",
  "killer",
  "damager",
  "victim",
  "shooter",
  "projectile",
  "last_entity",
] as const;

const BUILTINS = Object.keys(builtins);

export type TargetTokens = (typeof TARGETS)[number];

const VAR_SCOPES: VariableScope[] = ["@global", "@line", "@saved", "@thread"];
const TYPENAMES = ["void", "string", "number", "dict", "list", "any", "text", "boolean"];
const SKIP_CHARACTERS = ["\r", "\t", " "];

interface TokenTree {
  [char: string]: TokenType | TokenTree;
}

const CONSTANT_TOKENS = {
  ":": {
    "": TokenType.COLON,
    ":": TokenType.OPERATOR,
  },
  ";": TokenType.SEMICOLON,
  "(": TokenType.DELIMITER,
  ")": TokenType.DELIMITER,
  "{": TokenType.DELIMITER,
  "}": TokenType.DELIMITER,
  "[": TokenType.DELIMITER,
  "]": TokenType.DELIMITER,
  ".": TokenType.OPERATOR,
  "=": {
    "": TokenType.OPERATOR,
    "=": TokenType.OPERATOR,
  },
  "!": {
    "=": TokenType.OPERATOR,
  },
  ">": {
    "": TokenType.OPERATOR,
    "=": TokenType.OPERATOR,
  },
  "<": {
    "": TokenType.OPERATOR,
    "=": TokenType.OPERATOR,
  },
  "+": {
    "=": TokenType.OPERATOR,
  },
  "-": {
    "=": TokenType.OPERATOR,
  },
  "%": {
    "=": TokenType.OPERATOR,
  },
  "*": {
    "=": TokenType.OPERATOR,
  },
  "/": {
    "=": TokenType.OPERATOR,
  },
  ",": TokenType.COMMA,
} as const;

export type BinaryOperators = "==" | "!=" | ">" | ">=" | "<" | "<=" | "+" | "-" | "*" | "/" | "%";

export class Lexer {
  private pos: number = 0;
  private line: number = 0;
  private lineStart: number = 0;

  private source: string;
  private current: string;
  private errors: ErrorOptions[] = [];

  constructor(
    private file: SourceFile,
    private mode: "strict" | "tolerant",
  ) {
    this.source = file.content;
    this.current = this.source[0];
  }

  private location(): Location {
    return new Location(this.line, this.pos - this.lineStart);
  }

  private tryError(options: ErrorOptions) {
    if (this.mode === "strict") this.file.error(options);
    this.errors.push(options);
  }

  getErrors(): ErrorOptions[] {
    return this.errors;
  }

  private advance() {
    if (this.current === "\n") {
      this.line++;
      this.lineStart = this.pos + 1;
    }

    this.pos++;
    this.current = this.source[this.pos];
  }

  private isEOF() {
    return this.pos >= this.source.length;
  }

  next(): Token {
    while (!this.isEOF() && SKIP_CHARACTERS.includes(this.current)) {
      this.advance();
    }

    if (!this.isEOF() && this.current === ("#" as string)) {
      while (!this.isEOF() && this.current !== "\n") this.advance();

      return this.next();
    }

    if (this.isEOF()) {
      return new Token(TokenType.EOF, "", new Span(this.location(), this.location()));
    }

    const start = this.location();

    if (this.current === "\n") {
      this.advance();
      const previous = start.sub(0, 1);
      return new Token(TokenType.NEWLINE, "\n", new Span(previous, previous));
    }

    if (this.current in CONSTANT_TOKENS) {
      let curr = (CONSTANT_TOKENS as TokenTree)[this.current];
      let value = this.current;
      let char: string = this.source[this.pos + 1];

      while (typeof curr === "object" && char in curr) {
        value += char;
        curr = curr[char];
        char = this.source[this.pos + value.length];
      }

      if ((typeof curr === "object" && "" in curr && typeof curr[""] !== "object") || typeof curr !== "object") {
        const tokenType: TokenType = typeof curr === "object" ? (curr[""] as TokenType) : curr;

        for (let _ = 0; _ < value.length - 1; _++) this.advance();
        const end = this.location();
        this.advance();

        return new Token(tokenType, value, new Span(start, end));
      }
    }

    if (this.current === "@" || IDENTIFIER_PREFIX_REGEX.test(this.current)) {
      let ident = this.current;
      let end = start;
      this.advance();

      while (!this.isEOF() && IDENTIFIER_SUFFIX_REGEX.test(this.current)) {
        ident += this.current;
        end = this.location();
        this.advance();
      }

      let type: TokenType = TokenType.IDENTIFIER;

      if (ident.startsWith("@")) {
        if (!VAR_SCOPES.includes(ident as VariableScope))
          this.file.error({
            type: "Lexer",
            message: `unknown variable scope '${ident}'`,
            span: new Span(start, end),
          });

        type = TokenType.SCOPE;
      } else if (ident === "as") {
        type = TokenType.OPERATOR;
      } else if (KEYWORDS.includes(ident)) {
        type = TokenType.KEYWORD;
      } else if (BUILTINS.includes(ident)) {
        type = TokenType.BUILTIN;
      } else if (TARGETS.includes(ident as (typeof TARGETS)[number])) {
        type = TokenType.TARGET;
      } else if (TYPENAMES.includes(ident)) {
        type = TokenType.TYPENAME;
      }

      return new Token(type, ident, new Span(start, end));
    }

    if (this.current === ('"' as string) || this.current === ("'" as string)) {
      const opener = this.current;
      let content = "";

      this.advance();

      while (!this.isEOF()) {
        if (this.current === opener) break;
        if (this.current === "\n") {
          this.tryError({
            type: "Lexer",
            message: "unexpected newline inside string",
            span: new Span(this.location(), this.location()),
          });

          break;
        }

        if (this.current === "\\") {
          this.advance();

          if (this.pos + 1 >= this.source.length)
            this.file.error({
              type: "Lexer",
              message: "unexpected eof after \\",
              span: new Span(this.location(), this.location()),
            });

          switch (this.current) {
            case opener: {
              content += opener;
              this.advance();
              continue;
            }

            case "\\": {
              content += "\\";
              this.advance();
              continue;
            }

            default: {
              this.tryError({
                type: "Lexer",
                message: `invalid escape code '\\${this.current}'`,
                span: new Span(this.location(), this.location()),
              });

              this.advance();
            }
          }
        }

        content += this.current;
        this.advance();
      }

      const end = this.location();
      this.advance();

      return new Token(opener === "'" ? TokenType.STRING : TokenType.STYLED_TEXT, content, new Span(start, end));
    }

    if (isNumeric(this.current)) {
      let num = this.current;
      let isFloat = false;
      let end = start;
      this.advance();

      while (!this.isEOF() && (isNumeric(this.current) || (!isFloat && this.current === "."))) {
        if (this.current === ".") isFloat = true;
        num += this.current;
        end = this.location();

        this.advance();
      }

      return new Token(TokenType.NUMBER, num, new Span(start, end));
    }

    this.tryError({
      type: "Lexer",
      message: `unexpected character '${this.current}'`,
      span: new Span(this.location(), this.location()),
    });

    this.advance();

    return this.next();
  }

  *[Symbol.iterator](): Generator<Token> {
    while (!this.isEOF()) {
      yield this.next();
    }
  }
}
