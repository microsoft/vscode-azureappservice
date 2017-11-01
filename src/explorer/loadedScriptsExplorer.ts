import * as vscode from 'vscode';

import { TreeDataProvider, TreeItem, EventEmitter, Event, ProviderResult } from 'vscode';
import { Source } from 'vscode-debugadapter';

const AZURE_JS_DEBUG_TYPE = 'jsLogpoints';

export class LoadedScriptsProvider implements TreeDataProvider<BaseTreeItem> {
    private _root: RootTreeItem;

    private _onDidChangeTreeData: EventEmitter<BaseTreeItem> = new EventEmitter<BaseTreeItem>();
    readonly onDidChangeTreeData: Event<BaseTreeItem> = this._onDidChangeTreeData.event;

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
                timeout = setTimeout(() => {
                    this._onDidChangeTreeData.fire(undefined);
                }, 300);
            }

        }));

        context.subscriptions.push(vscode.debug.onDidTerminateDebugSession(session => {
            this._root.remove(session.id);
            this._onDidChangeTreeData.fire(undefined);
        }));
    }

    getChildren(node?: BaseTreeItem): ProviderResult<BaseTreeItem[]> {
        return (node || this._root).getChildren();
    }

    getTreeItem(node: BaseTreeItem): TreeItem {
        return node;
    }
}

class BaseTreeItem extends TreeItem {

    private _children: { [key: string]: BaseTreeItem; };

    constructor(label: string, state = vscode.TreeItemCollapsibleState.Collapsed) {
        super(label, state);
        this._children = {};
    }

    setSource(session: vscode.DebugSession, source: Source): void {
        this.command = {
            command: 'diagnostics.LogPoints.OpenScript',
            arguments: [session, source],
            title: ''
        };
    }

    getChildren(): ProviderResult<BaseTreeItem[]> {
        this.collapsibleState = vscode.TreeItemCollapsibleState.Expanded;
        const array = Object.keys(this._children).map(key => this._children[key]);
        return array.sort((a, b) => this.compare(a, b));
    }

    createIfNeeded<T extends BaseTreeItem>(key: string, factory: (label: string) => T): T {
        let child = <T>this._children[key];
        if (!child) {
            child = factory(key);
            this._children[key] = child;
        }
        return child;
    }

    remove(key: string): void {
        delete this._children[key];
    }

    protected compare(a: BaseTreeItem, b: BaseTreeItem): number {
        return a.label.localeCompare(b.label);
    }
}

class RootTreeItem extends BaseTreeItem {

    private _showedMoreThanOne: boolean;

    constructor() {
        super('Root', vscode.TreeItemCollapsibleState.Expanded);
        this._showedMoreThanOne = false;
    }

    getChildren(): ProviderResult<BaseTreeItem[]> {

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

    add(session: vscode.DebugSession): SessionTreeItem {
        return this.createIfNeeded(session.id, () => new SessionTreeItem(session));
    }
}

const URL_REGEXP = /^(https?:\/\/[^/]+)(\/.*)$/;

class SessionTreeItem extends BaseTreeItem {

    private _session: vscode.DebugSession;
    private _initialized: boolean;

    constructor(session: vscode.DebugSession) {
        super(session.name, vscode.TreeItemCollapsibleState.Expanded);
        this._initialized = false;
        this._session = session;
    }

    getChildren(): ProviderResult<BaseTreeItem[]> {

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

        // workspace scripts come at the beginning in "folder" order
        if (item instanceof FolderTreeItem) {
            return item.folder.index;
        }

        // <...> come at the very end
        if (/^<.+>$/.test(item.label)) {
            return 1000;
        }

        // everything else in between
        return 999;
    }

    addPath(source: Source): void {

        let folder: vscode.WorkspaceFolder | undefined;
        let url: string;
        let p: string;

        let path = source.path;

        const match = URL_REGEXP.exec(path);
        if (match && match.length === 3) {
            url = match[1];
            p = decodeURI(match[2]);
        } else {
            folder = vscode.workspace.getWorkspaceFolder(vscode.Uri.file(path));
            p = trim(path);
        }

        let x: BaseTreeItem = this;
        p.split(/[\/\\]/).forEach((segment, i) => {
            if (segment.length === 0) {	// macOS or unix path
                segment = '/';
            }
            if (i === 0 && folder) {
                x = x.createIfNeeded(folder.name, () => new FolderTreeItem(<vscode.WorkspaceFolder>folder));
            } else if (i === 0 && url) {
                x = x.createIfNeeded(url, () => new BaseTreeItem(url));
            } else {
                x = x.createIfNeeded(segment, () => new BaseTreeItem(segment));
            }
        });

        x.collapsibleState = vscode.TreeItemCollapsibleState.None;
        x.setSource(this._session, source);
    }
}

class FolderTreeItem extends BaseTreeItem {

    folder: vscode.WorkspaceFolder;

    constructor(folder: vscode.WorkspaceFolder) {
        super(folder.name, vscode.TreeItemCollapsibleState.Collapsed);
        this.folder = folder;
    }
}

let USERHOME: string;


function getUserHome(): string {

    if (!USERHOME) {
        USERHOME = require('os').homedir();
        if (USERHOME && USERHOME[USERHOME.length - 1] !== '/') {
            USERHOME += '/';
        }
    }

    return USERHOME;
}

function trim(path: string): string {
    path = vscode.workspace.asRelativePath(path, true);

    if (path.indexOf('/') === 0) {

        path = path.replace(getUserHome(), '~/');

    }

    return path;
}
