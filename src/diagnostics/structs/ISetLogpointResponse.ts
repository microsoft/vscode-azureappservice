export interface ISetLogpointResponse {
    error?: {};
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
