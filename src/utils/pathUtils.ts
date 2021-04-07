/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as path from 'path';
import { TreeItemIconPath } from 'vscode-azureextensionui';
import { ext } from '../extensionVariables';

export function isSubpath(expectedParent: string, expectedChild: string): boolean {
    const relativePath: string = path.relative(expectedParent, expectedChild);
    return relativePath !== '' && !relativePath.startsWith('..') && relativePath !== expectedChild;
}

export function isPathEqual(fsPath1: string, fsPath2: string): boolean {
    const relativePath: string = path.relative(fsPath1, fsPath2);
    return relativePath === '';
}

export function getIconPath(iconName: string): string {
    return path.join(getResourcesPath(), `${iconName}.svg`);
}

export function getThemedIconPath(iconName: string): TreeItemIconPath {
    return {
        light: path.join(getResourcesPath(), 'light', `${iconName}.svg`),
        dark: path.join(getResourcesPath(), 'dark', `${iconName}.svg`)
    };
}

export function getResourcesPath(): string {
    return ext.context.asAbsolutePath('resources');
}
