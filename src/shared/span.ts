export class Location {
  constructor(
    public line: number,
    public col: number,
  ) {}
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
    if (location.line === this.end.line) return location.line <= this.end.col;

    return location.line > this.start.line && location.line < this.end.line;
  }
}
