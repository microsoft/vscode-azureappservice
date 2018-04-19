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
                this._json = null;
            }
        }

        return this._json;
    }

    private parseStdOut(): void {
        try {
            const outputJson = JSON.parse(this.output);

            this._stdout = outputJson.stdout;
            if (!this.error) {
                this.error = outputJson.stderr;
            }
        } catch (err) {
            this._stdout = null;
        }
    }
}
