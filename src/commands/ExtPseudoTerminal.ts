/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { CancellationToken, CancellationTokenSource, Event, EventEmitter, Pseudoterminal } from 'vscode';
import { CommandLineBuilder } from './commandLineBuilder';
import { resolveVariables } from './resolveVariables';
import { spawnAsync } from './spawnAsync';

const DEFAULT = '0m';
const DEFAULTBOLD = '0;1m';
const YELLOW = '33m';

export class ExtPseudoterminal implements Pseudoterminal {
    private readonly closeEmitter: EventEmitter<number> = new EventEmitter<number>();
    private readonly writeEmitter: EventEmitter<string> = new EventEmitter<string>();
    private readonly cts: CancellationTokenSource = new CancellationTokenSource();
    private command: CommandLineBuilder;

    /* eslint-disable no-invalid-this */
    public readonly onDidWrite: Event<string> = this.writeEmitter.event;
    public readonly onDidClose: Event<number> = this.closeEmitter.event;
    /* eslint-enable no-invalid-this */



    public constructor(command: CommandLineBuilder) {
        this.command = command;
    }

    public open(): void {
        const stdoutBuffer = Buffer.alloc(4 * 1024); // Any output beyond 4K is not a container ID and we won't deal with it
        const stderrBuffer = Buffer.alloc(10 * 1024);
        void this.executeCommandInTerminal(this.command, true, stdoutBuffer, stderrBuffer);
    }

    public close(code?: number): void {
        this.cts.cancel();
        this.closeEmitter.fire(code || 0);
    }

    public async executeCommandInTerminal(command: CommandLineBuilder, rejectOnStderr?: boolean, stdoutBuffer?: Buffer, stderrBuffer?: Buffer, token?: CancellationToken): Promise<void> {
        const commandLine = resolveVariables(command.build());

        // Output what we're doing, same style as VSCode does for ShellExecution/ProcessExecution
        this.write(`> ${commandLine} <\r\n\r\n`, DEFAULTBOLD);

        const newEnv = { ...process.env };
        await spawnAsync(
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
            commandLine!,
            { env: newEnv },
            (stdout: string) => {
                this.writeOutput(stdout);
            },
            stdoutBuffer,
            (stderr: string) => {
                this.writeError(stderr);

                if (rejectOnStderr) {
                    throw new Error(stderr);
                }
            },
            stderrBuffer,
            token
        );
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

    private write(message: string, color: string): void {
        message = message.replace(/\r?\n/g, '\r\n'); // The carriage return (/r) is necessary or the pseudoterminal does not return back to the start of line
        this.writeEmitter.fire(`\x1b[${color}${message}\x1b[0m`);
    }
}
