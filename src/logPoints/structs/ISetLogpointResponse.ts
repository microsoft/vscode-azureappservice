export interface ISetLogpointResponse {
    error?: {
        // tslint:disable-next-line:no-reserved-keywords
        "type": string,
        message: string
    };
    data: {
        "logpoint": {
            "logpointId": string,
            "requestedLocation": {
                "scriptId": string,
                "zeroBasedLineNumber": number,
                "zeroBasedColumnNumber": number
            },
            "actualLocation": {
                "scriptId": string,
                "zeroBasedLineNumber": number,
                "zeroBasedColumnNumber": number
            },
            "expressionToLog": string
        }
    };
}
