/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

export class CommandRunResult<ResponseType extends { error?: {}, data?: {} }> {
    private _json: ResponseType | undefined;
    private _stdout: string | undefined;
    constructor(public error: {} | undefined, public exitCode: number, public output: string) {
        this.parseStdOut();
    }

    public isSuccessful(): boolean {
        return !!(this.exitCode === 0 && this.json && !this.json.error);
    }

    public get json(): ResponseType | undefined {
        if (this._json === undefined) {
            try {
                this._json = this._stdout ? JSON.parse(this._stdout) : undefined;
            } catch (err) {
                this._json = undefined;
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
            this._stdout = undefined;
        }
    }
}
