/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { FileStat, FileType, MessageItem, Uri } from "vscode";
import { FileTreeItem, getFile, ISiteFile, putFile } from "vscode-azureappservice";
import { AzExtTreeFileSystem, DialogResponses, IActionContext, IParsedError, parseError, UserCancelledError } from 'vscode-azureextensionui';
import { ext } from "./extensionVariables";
import { localize } from "./localize";
import { nonNullValue } from "./utils/nonNull";
import { getWorkspaceSetting, updateGlobalSetting } from "./vsCodeConfig/settings";

export class AppServiceFileSystem extends AzExtTreeFileSystem<FileTreeItem> {
    public static scheme: string = 'azureAppService';
    public scheme: string = AppServiceFileSystem.scheme;
    private _etags: Map<string, string> = new Map<string, string>();

    public getFilePath(node: FileTreeItem): string {
        return node.label;
    }

    public async statImpl(_context: IActionContext, _node: FileTreeItem): Promise<FileStat> {
        // this is not implemented for Azure App Services
        return { type: FileType.File, ctime: 0, mtime: 0, size: 0 };
    }

    public async readFileImpl(_context: IActionContext, node: FileTreeItem): Promise<Uint8Array> {
        const result: ISiteFile = await getFile(node.client, node.path);
        this._etags.set(node.fullId, result.etag);
        return Buffer.from(result.data);
    }

    public async writeFileImpl(_context: IActionContext, node: FileTreeItem, content: Uint8Array, _originalUri: Uri): Promise<void> {
        const showSavePromptKey: string = 'showSavePrompt';
        if (getWorkspaceSetting<boolean>(showSavePromptKey)) {
            const message: string = localize('saveConfirmation', 'Saving "{0}" will update the file "{0}" in "{1}".', node.label, node.client.fullName);
            const result: MessageItem | undefined = await ext.ui.showWarningMessage(message, DialogResponses.upload, DialogResponses.alwaysUpload, DialogResponses.dontUpload);
            if (result === DialogResponses.alwaysUpload) {
                await updateGlobalSetting(showSavePromptKey, false);
            } else if (result === DialogResponses.dontUpload) {
                throw new UserCancelledError();
            }
        }

        let etag: string = nonNullValue(this._etags.get(node.fullId), 'etag');
        try {
            await putFile(node.client, content.toString(), node.path, etag);
        } catch (error) {
            const parsedError: IParsedError = parseError(error);
            if (parsedError.errorType === '412' && /etag/i.test(parsedError.message)) {
                throw new Error(`ETag does not represent the latest state of the file "${node.label}". Download the file from Azure to get the latest version.`);
            }
            throw error;
        }

        etag = (await getFile(node.client, node.path)).etag;
        this._etags.set(node.fullId, etag);
        await node.refresh();
    }
}
