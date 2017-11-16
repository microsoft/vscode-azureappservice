export class Logpoint {
    /**
     * @param line 1-based.
     * @param column
     * @param expression
     */
    public constructor(public id: string, public line: number, public column: number, public expression: string) { }
}
