declare module 'fast-formula-parser' {
  type Reference = { sheet?: string; row: number; col: number };
  export default class FormulaParser {
    constructor(options: {
      onCell: (reference: Reference) => unknown;
      onRange: (reference: {
        sheet?: string;
        from: Reference;
        to: Reference;
      }) => unknown[][];
      functions?: Record<string, (...args: unknown[]) => unknown>;
    });
    parse(formula: string, position: Reference, allowArray?: boolean): unknown;
  }
}
