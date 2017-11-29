export interface IGetLogpointsResponse {
    data: {
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
    }[];
}
