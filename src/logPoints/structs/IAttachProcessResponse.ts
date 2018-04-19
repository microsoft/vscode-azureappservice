export interface IAttachProcessResponse {
    error?: {
        // tslint:disable-next-line:no-reserved-keywords
        "type": string,
        message: string
    };
    data: {
        debugeeId: string;
    };
}
