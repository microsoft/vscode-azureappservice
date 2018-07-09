/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';

import { Event, EventEmitter, ProviderResult, TreeDataProvider, TreeItem } from 'vscode';
import { Source } from 'vscode-debugadapter/lib/main';
import { RemoteScriptSchema } from '../logPoints/remoteScriptDocumentProvider';

const AZURE_JS_DEBUG_TYPE = 'jsLogpoints';

export class LoadedScriptsProvider implements TreeDataProvider<BaseTreeItem> {
    private _root: RootTreeItem;

    private _onDidChangeTreeData: EventEmitter<BaseTreeItem> = new EventEmitter<BaseTreeItem>();
    // tslint:disable-next-line:member-ordering
    public readonly onDidChangeTreeData: Event<BaseTreeItem> = this._onDidChangeTreeData.event;

    constructor(context: vscode.ExtensionContext) {

        this._root = new RootTreeItem();

        context.subscriptions.push(vscode.debug.onDidStartDebugSession(session => {
            const t = session ? session.type : undefined;
            if (t === AZURE_JS_DEBUG_TYPE) {
                this._root.add(session);
                this._onDidChangeTreeData.fire(undefined);
            }
        }));

        let timeout: NodeJS.Timer;

        context.subscriptions.push(vscode.debug.onDidReceiveDebugSessionCustomEvent(event => {

            const t = (event.event === 'loadedSource' && event.session) ? event.session.type : undefined;
            if (t === AZURE_JS_DEBUG_TYPE) {

                const sessionRoot = this._root.add(event.session);

                sessionRoot.addPath(<Source>event.body);

                clearTimeout(timeout);
                timeout = setTimeout(() => { this._onDidChangeTreeData.fire(undefined); }, 300);
            }

        }));

        context.subscriptions.push(vscode.debug.onDidTerminateDebugSession(session => {
            this._root.remove(session.id);
            this._onDidChangeTreeData.fire(undefined);
        }));
    }

    public getChildren(node?: BaseTreeItem): ProviderResult<BaseTreeItem[]> {
        return (node || this._root).getChildren();
    }

    public getTreeItem(node: BaseTreeItem): TreeItem {
        return node;
    }
}

class BaseTreeItem extends TreeItem {

    private _children: { [key: string]: BaseTreeItem; };

    constructor(label: string, state: number = vscode.TreeItemCollapsibleState.Collapsed) {
        super(label, state);
        this._children = {};
    }

    public setSource(session: vscode.DebugSession, source: Source): void {
        this.command = {
            command: 'appService.LogPoints.OpenScript',
            arguments: [session, source],
            title: ''
        };
    }

    public getChildren(): ProviderResult<BaseTreeItem[]> {
        this.collapsibleState = vscode.TreeItemCollapsibleState.Expanded;
        const array = Object.keys(this._children).map(key => this._children[key]);
        return array.sort((a, b) => this.compare(a, b));
    }

    public createIfNeeded<T extends BaseTreeItem>(key: string, factory: (label: string) => T): T {
        let child = <T>this._children[key];
        if (!child) {
            child = factory(key);
            this._children[key] = child;
        }
        return child;
    }

    public remove(key: string): void {
        delete this._children[key];
    }

    protected compare(a: BaseTreeItem, b: BaseTreeItem): number {
        return a.label!.localeCompare(b.label!); // non-null behavior unknown. Should be handled by logPoints team
    }
}

class RootTreeItem extends BaseTreeItem {

    private _showedMoreThanOne: boolean;

    constructor() {
        super('Root', vscode.TreeItemCollapsibleState.Expanded);
        this._showedMoreThanOne = false;
    }

    public getChildren(): ProviderResult<BaseTreeItem[]> {

        // skip sessions if there is only one
        const children = super.getChildren();
        if (Array.isArray(children)) {
            const size = children.length;
            if (!this._showedMoreThanOne && size === 1) {
                return children[0].getChildren();
            }
            this._showedMoreThanOne = size > 1;
        }
        return children;
    }

    public add(session: vscode.DebugSession): SessionTreeItem {
        return this.createIfNeeded(session.id, () => new SessionTreeItem(session));
    }
}

// tslint:disable:max-classes-per-file
class SessionTreeItem extends BaseTreeItem {

    private _session: vscode.DebugSession;
    private _initialized: boolean;

    constructor(session: vscode.DebugSession) {
        super(session.name, vscode.TreeItemCollapsibleState.Expanded);
        this._initialized = false;
        this._session = session;
    }

    public getChildren(): ProviderResult<BaseTreeItem[]> {

        if (!this._initialized) {
            this._initialized = true;
            //return listLoadedScripts(this._session).then(paths => {
            return Promise.resolve([]).then(paths => {
                if (paths) {
                    paths.forEach(path => this.addPath(path));
                }
                return super.getChildren();
            });
        }

        return super.getChildren();
    }

    public addPath(source: Source): void {

        const path = source.path;

        // tslint:disable-next-line:no-var-self
        let x: BaseTreeItem = this;
        path.split(/[\/\\]/).forEach((segment) => {
            if (segment.length === 0) {	// macOS or unix path
                segment = '/';
            }

            x = x.createIfNeeded(segment, () => new BaseTreeItem(segment));
        });

        x.collapsibleState = vscode.TreeItemCollapsibleState.None;
        x.setSource(this._session, source);
    }

    protected compare(a: BaseTreeItem, b: BaseTreeItem): number {
        const acat = this.category(a);
        const bcat = this.category(b);
        if (acat !== bcat) {
            return acat - bcat;
        }
        return super.compare(a, b);
    }

    /**
     * Return an ordinal number for folders
     */
    private category(item: BaseTreeItem): number {

        // <...> come at the very end
        if (/^<.+>$/.test(item.label!)) { // non-null behavior unknown. Should be handled by logPoints team
            return 1000;
        }

        // everything else in between
        return 999;
    }
}

export function openScript(session: vscode.DebugSession | undefined, source: Source): void {
    if (!session) {
        vscode.window.showErrorMessage("Cannot find the debug session");
        return;
    }
    const uri = RemoteScriptSchema.create(session, source);
    vscode.workspace.openTextDocument(uri).then(doc => vscode.window.showTextDocument(doc));
}
