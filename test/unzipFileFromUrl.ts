/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as AdmZip from 'adm-zip';
import * as fse from 'fs-extra';
import { OutgoingHttpHeaders } from 'http';
import * as https from 'https';
import * as path from 'path';
import * as url from 'url';
import { Uri } from 'vscode';
import { appendExtensionUserAgent } from 'vscode-azureextensionui';

const userAgentKey = 'User-Agent';

function addUserAgent(options: { headers?: OutgoingHttpHeaders }): void {
    if (!options.headers) {
        options.headers = {};
    }

    // tslint:disable-next-line: no-unsafe-any
    const userAgent = appendExtensionUserAgent(<string>options.headers[userAgentKey]);
    // tslint:disable-next-line: no-unsafe-any
    options.headers[userAgentKey] = userAgent;
}

function convertToOptions(options: https.RequestOptions | string): https.RequestOptions {
    if (typeof options === 'string') {
        // Must use Node's url, not vscode.Uri
        const optionsAsUrl: url.UrlWithStringQuery = url.parse(options);
        return <https.RequestOptions>optionsAsUrl;
    } else {
        return options;
    }
}

async function httpsRequestBinary(opts: https.RequestOptions | string): Promise<Buffer> {
    const convertedOpts: https.RequestOptions = convertToOptions(opts);
    addUserAgent(convertedOpts);

    let buffer = Buffer.alloc(0);
    return new Promise<Buffer>((resolve, reject) => {
        const req = https.request(convertedOpts, (res) => {
            res.on('data', (d: Buffer) => {
                buffer = Buffer.concat([buffer, d]);
            });
            res.on('end', () => {
                resolve(buffer);
            });
        });
        req.end();
        req.on('error', reject);
    });
}

// tslint:disable-next-line: export-name
export async function unzipFileFromUrl(uri: Uri, sourceFolderInZip: string, outputFolder: string): Promise<void> {
    const zipContents = await httpsRequestBinary(uri.toString());
    const zip = new AdmZip(zipContents);
    await extractFolderTo(zip, sourceFolderInZip, outputFolder);
}

async function extractFolderTo(zip: AdmZip, sourceFolderInZip: string, outputFolder: string): Promise<void> {
    if (!(sourceFolderInZip.endsWith('/') || sourceFolderInZip.endsWith('\\'))) {
        sourceFolderInZip += '/';
    }
    const zipEntries = zip.getEntries();
    for (const entry of zipEntries) {
        if (entry.entryName.startsWith(sourceFolderInZip)) {
            const relativePath = entry.entryName.slice(sourceFolderInZip.length);
            if (!relativePath) {
                continue;
            }
            const outPath = path.join(outputFolder, relativePath);
            if (entry.isDirectory) {
                await fse.mkdirs(outPath);
            } else {
                const data: Buffer = entry.getData();
                await fse.writeFile(outPath, data);
            }
        }
    }
}
