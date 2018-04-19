export interface ISetLogpointRequest {
    sessionId: string;
    debugId: string;
    sourceId: string;
    lineNumber: number;
    columNumber: number;
    expression: string;
}
