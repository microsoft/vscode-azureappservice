export class CommandRunResult<ResponseType extends { error?: {}, data?: {} }> {
    private _json: ResponseType;
    private _stdout: string;
    constructor(public error: {}, public exitCode: number, public output: string) {
        this.parseStdOut();
    }

    public isSuccessful(): boolean {
        return this.exitCode === 0 && this.json && !this.json.error;
    }

    public get json(): ResponseType {
        if (this._json === undefined) {
            try {
                this._json = JSON.parse(this._stdout);
            } catch (err) {
                // tslint:disable-next-line:no-suspicious-comment
                // TODO: re-enable.
                // util.getOutputChannel().appendLine(`API call error ${err.toString()}`);
                this._json = null;
            }
        }

        return this._json;
    }

    private parseStdOut(): void {
        try {
            const outputJson = JSON.parse(this.output);

            this._stdout = outputJson.stdout;
        } catch (err) {
            // tslint:disable-next-line:no-suspicious-comment
            // TODO: re-enable.
            // util.getOutputChannel().appendLine(`API call error ${err.toString()}`);
            this._stdout = null;
        }
    }
}
