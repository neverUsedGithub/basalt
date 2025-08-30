export class Location {
  constructor(
    public line: number,
    public col: number,
  ) {}

  sub(lines: number, cols: number) {
    return new Location(this.line - lines, this.col - cols);
  }

  lessThan(location: Location) {
    return (this.line < location.line) || (this.line === location.line && this.col < location.col);
  }
  
  lessThanEqual(location: Location) {
    return (this.line < location.line) || (this.line === location.line && this.col <= location.col);
  }

  moreThan(location: Location) {
    return (this.line > location.line) || (this.line === location.line && this.col > location.col);
  }

  moreThanEqual(location: Location) {
    return (this.line > location.line) || (this.line === location.line && this.col >= location.col);
  }
}

export class Span {
  constructor(
    public start: Location,
    public end: Location,
  ) {}

  intersects(span: Span): boolean {
    return this.contains(span.start) || this.contains(span.end);
  }

  contains(location: Location): boolean {
    if (location.line === this.start.line) return location.col >= this.start.col;
    if (location.line === this.end.line) return location.col <= this.end.col;

    return location.line > this.start.line && location.line < this.end.line;
  }

  lessThan(span: Span) {
    return (this.end.line < span.start.line) || (this.end.line === span.start.line && this.end.col < span.start.col);
  }

  lessThanEqual(span: Span) {
    return (this.end.line < span.start.line) || (this.end.line === span.start.line && this.end.col <= span.start.col);
  }

  moreThan(span: Span) {
    return (this.start.line > span.end.line) || (this.start.line === span.end.line && this.start.col > span.end.col);
  }

  moreThanEqual(span: Span) {
    return (this.start.line > span.end.line) || (this.start.line === span.end.line && this.start.col >= span.end.col);
  }
}
