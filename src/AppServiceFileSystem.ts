/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { getFile, putFile, type FileTreeItem, type ISiteFile } from "@microsoft/vscode-azext-azureappservice";
import { AzExtTreeFileSystem, DialogResponses, UserCancelledError, parseError, type IActionContext, type IParsedError } from '@microsoft/vscode-azext-utils';
import { FileType, type FileStat, type MessageItem, type Uri } from "vscode";
import { ext } from "./extensionVariables";
import { localize } from "./localize";
import { nonNullValue } from "./utils/nonNull";
import { getWorkspaceSetting, updateGlobalSetting } from "./vsCodeConfig/settings";

export type FileSystemItem = FileTreeItem & { id: string };

export class AppServiceFileSystem extends AzExtTreeFileSystem<FileSystemItem> {
    public static scheme: string = 'azureAppService';
    public scheme: string = AppServiceFileSystem.scheme;
    private _etags: Map<string, string> = new Map<string, string>();

    public getFilePath(node: FileSystemItem): string {
        return node.label;
    }

    // eslint-disable-next-line @typescript-eslint/require-await
    public async statImpl(_context: IActionContext, _node: FileSystemItem): Promise<FileStat> {
        // this is not implemented for Azure App Services
        return { type: FileType.File, ctime: 0, mtime: 0, size: 0 };
    }

    public async readFileImpl(context: IActionContext, node: FileSystemItem): Promise<Uint8Array> {
        const result: ISiteFile = await getFile(context, node.site, node.url);
        this._etags.set(node.fullId, result.etag);
        return new Uint8Array(Buffer.from(result.data));
    }

    public async writeFileImpl(context: IActionContext, node: FileSystemItem, content: Uint8Array, _originalUri: Uri): Promise<void> {
        const showSavePromptKey: string = 'showSavePrompt';
        if (getWorkspaceSetting<boolean>(showSavePromptKey)) {
            const message: string = localize('saveConfirmation', 'Saving "{0}" will update the file "{0}" in "{1}".', node.label, node.site.fullName);
            const result: MessageItem | undefined = await context.ui.showWarningMessage(message, DialogResponses.upload, DialogResponses.alwaysUpload, DialogResponses.dontUpload);
            if (result === DialogResponses.alwaysUpload) {
                await updateGlobalSetting(showSavePromptKey, false);
            } else if (result === DialogResponses.dontUpload) {
                throw new UserCancelledError('dontUpload');
            }
        }

        let etag: string = nonNullValue(this._etags.get(node.fullId), 'etag');
        try {
            this.appendLineToOutput(localize('updating', 'Updating "{0}" ...', node.label), { resourceName: node.site.fullName });
            const buffer = Buffer.from(content);
            const arrayBuffer = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength) as ArrayBuffer;
            await putFile(context, node.site, arrayBuffer, node.url, etag);
            this.appendLineToOutput(localize('done', 'Updated "{0}".', node.label), { resourceName: node.site.fullName });
        } catch (error) {
            const parsedError: IParsedError = parseError(error);
            if (parsedError.errorType === '412' && /etag/i.test(parsedError.message)) {
                throw new Error(localize('etagError', 'ETag does not represent the latest state of the file "{0}". Download the file from Azure to get the latest version.', node.label));
            }
            throw error;
        }

        etag = (await getFile(context, node.site, node.url)).etag;
        this._etags.set(node.fullId, etag);
        await node.refresh(context);
    }

    public appendLineToOutput(value: string, options?: { resourceName?: string, date?: Date }): void {
        ext.outputChannel.appendLog(value, options);
    }
}
