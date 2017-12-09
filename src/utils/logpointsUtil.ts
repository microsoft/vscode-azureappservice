import { setTimeout } from "timers";

export const DEFAULT_TIMEOUT = 20000;
// tslint:disable-next-line:export-name
// tslint:disable-next-line:no-any
export function callWithTimeout<T>(proc: (...args: any[]) => Promise<T>, timeout: number): Promise<T> {
    return new Promise<T>((resolve, reject) => {
        const timer = setTimeout(
            () => {
                reject(new Error(`Invocation timed out after ${timeout} milliseconds.`));
            },
            timeout
        );

        if (!proc) {
            reject("Procedure cannot be null");
        }

        proc().then((result) => {
            clearTimeout(timer);
            resolve(result);
        });
    });
}
