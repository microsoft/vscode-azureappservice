/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { CancellationTokenSource, env, Event, EventEmitter, Pseudoterminal } from 'vscode';

const DEFAULT = '0m';
const DEFAULTBOLD = '0;1m';
const YELLOW = '33m';

export class ExtPseudoterminal implements Pseudoterminal {
    private readonly closeEmitter: EventEmitter<number> = new EventEmitter<number>();
    private readonly writeEmitter: EventEmitter<string> = new EventEmitter<string>();
    private readonly handleInputEmitter: EventEmitter<string> = new EventEmitter<string>();
    private readonly cts: CancellationTokenSource = new CancellationTokenSource();
    private file: string;
    private args: string | string[];

    /* eslint-disable no-invalid-this */
    public readonly onDidWrite: Event<string> = this.writeEmitter.event;
    public readonly onDidClose: Event<number> = this.closeEmitter.event;
    /* eslint-enable no-invalid-this */

    public constructor(file: string, args: string | string[]) {
        this.file = file;
        this.args = args;
    }

    public open(): void {
        void this.executeCommandInTerminal(this.file, this.args);
    }

    public close(code?: number): void {
        this.cts.cancel();
        this.closeEmitter.fire(code || 0);
    }

    public async executeCommandInTerminal(file: string, args: string | string[]): Promise<void> {

        const pty = getCoreNodeModule<typeof import('node-pty')>('node-pty');
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        const newEnv = { ...process.env };
        // https://github.com/microsoft/node-pty/blob/main/examples/electron/renderer.js
        const ptyProcess = pty!.spawn(file, args, {
            name: 'xterm-color',
            cols: 80,
            rows: 30,
            cwd: process.env.HOME,
            env: newEnv
        });
        await new Promise<void>((resolve, reject) => {
            ptyProcess.onData((data) => {
                if (data === 'root@127.0.0.1\'s password: ') {
                    ptyProcess.write('Docker!\r\n');
                } else {
                    this.writeOutput(data);
                }
            });
            this.handleInputEmitter.event((data) => {
                ptyProcess.write(data);
            });
            ptyProcess.onExit(e => {
                if (e.exitCode === 0) {
                    resolve();
                } else {
                    reject();
                }
            })
        });
    }

    public writeOutput(message: string): void {
        this.write(message, DEFAULT);
    }

    public writeWarning(message: string): void {
        this.write(message, YELLOW);
    }

    public writeError(message: string): void {
        this.write(message, DEFAULT);
    }

    public writeOutputLine(message: string): void {
        this.writeOutput(`${message}\r\n`); // The carriage return (/r) is necessary or the pseudoterminal does not return back to the start of line
    }

    public writeWarningLine(message: string): void {
        this.writeWarning(`${message}\r\n`); // The carriage return (/r) is necessary or the pseudoterminal does not return back to the start of line
    }

    public writeErrorLine(message: string): void {
        this.writeError(`${message}\r\n`); // The carriage return (/r) is necessary or the pseudoterminal does not return back to the start of line
    }

    private _line: string = '';
    public handleInput(data: string): void {
        // https://github.com/microsoft/vscode-extension-samples/blob/main/extension-terminal-sample/src/extension.ts
        if (data === '\x7f') { // Backspace
            if (this._line.length === 0) {
                return;
            }
            this._line = this._line.substr(0, this._line.length - 1);
            // Move cursor backward
            this.writeEmitter.fire('\x1b[D');
            // Delete character
            this.writeEmitter.fire('\x1b[P');
        } else if (data === '\r') { // Enter
            this.handleInputEmitter.fire(`${this._line}\n`);
            this._line = '';
            this.writeEmitter.fire('\r\n');
        } else {
            this._line += data;
            this.writeEmitter.fire(data);
        }
    }

    private write(message: string, color: string): void {
        message = message.replace(/\r?\n/g, '\r\n'); // The carriage return (/r) is necessary or the pseudoterminal does not return back to the start of line
        this.writeEmitter.fire(`\x1b[${color}${message}\x1b[0m`);
    }
}

export function getCoreNodeModule<T>(moduleName: string): T | undefined {
    try {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-return
        return require(`${env.appRoot}/node_modules.asar/${moduleName}`);
    } catch (err) {
        // ignore
    }

    try {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-return
        return require(`${env.appRoot}/node_modules/${moduleName}`);
    } catch (err) {
        // ignore
    }
    return undefined;
}
