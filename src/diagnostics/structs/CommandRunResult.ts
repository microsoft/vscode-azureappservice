export class CommandRunResult<ResponseType extends { error?: {}, data?: {} }> {
    private _json: ResponseType;
    constructor(public error: {}, public exitCode: number, public output: string) {
    }

    public isSuccessful(): boolean {
        return this.exitCode === 0 && this.json && !this.json.error;
    }

    public get json(): ResponseType {
        if (this._json === undefined) {
            try {
                this._json = JSON.parse(this.output);
            } catch (err) {
                // tslint:disable-next-line:no-suspicious-comment
                // TODO: re-enable.
                // util.getOutputChannel().appendLine(`API call error ${err.toString()}`);
                this._json = null;
            }
        }

        return this._json;
    }
}
