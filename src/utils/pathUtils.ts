/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { type TreeItemIconPath } from '@microsoft/vscode-azext-utils';
import * as path from 'path';
import { Uri } from 'vscode';
import { ext } from '../extensionVariables';

export function isSubpath(expectedParent: string, expectedChild: string): boolean {
    const relativePath: string = path.relative(expectedParent, expectedChild);
    return relativePath !== '' && !relativePath.startsWith('..') && relativePath !== expectedChild;
}

export function isPathEqual(fsPath1: string, fsPath2: string): boolean {
    const relativePath: string = path.relative(fsPath1, fsPath2);
    return relativePath === '';
}

export function getIconPath(iconName: string): Uri {
    return Uri.file(path.join(getResourcesPath(), `${iconName}.svg`));
}

export function getThemedIconPath(iconName: string): TreeItemIconPath {
    return {
        light: Uri.file(path.join(getResourcesPath(), 'light', `${iconName}.svg`)),
        dark: Uri.file(path.join(getResourcesPath(), 'dark', `${iconName}.svg`))
    };
}

export function getResourcesPath(): string {
    return ext.context.asAbsolutePath('resources');
}
