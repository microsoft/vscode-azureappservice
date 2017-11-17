export interface IEnumerateProcessResponse {
    data: {
        pid: string;
        command: string;
        // tslint:disable-next-line:no-banned-terms
        arguments: string[];
    }[];
}
