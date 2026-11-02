/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { WebSiteManagementClient } from '@azure/arm-appservice';
import { createHttpHeaders, createPipelineRequest, type PipelineResponse } from '@azure/core-rest-pipeline';
import { FileTreeItem, FolderTreeItem, ParsedSite, SiteClient } from '@microsoft/vscode-azext-azureappservice';
import { AzExtTreeDataProvider, DialogResponses, GenericParentTreeItem, UserCancelledError, createTestActionContext, type IActionContext, type ISubscriptionContext } from '@microsoft/vscode-azext-utils';
import * as assert from 'assert';
import { Readable } from 'stream';
import { TabInputCustom, Uri, extensions, window, workspace, type Tab } from 'vscode';
import { AppServiceFileSystem, type FileSystemItem } from '../src/AppServiceFileSystem';
import { showFile } from '../src/commands/showFile';
import { ext } from '../src/extensionVariables';
import { getGlobalSetting, updateGlobalSetting } from '../src/vsCodeConfig/settings';

const subscription: ISubscriptionContext = {
    subscriptionId: 'subscription',
    subscriptionPath: '/subscriptions/subscription',
    subscriptionDisplayName: 'Test subscription',
    tenantId: 'tenant',
    userId: 'account',
    credentials: { getToken: async () => { throw new Error('Tests must not authenticate.'); } },
    createCredentialsForScopes: async () => { throw new Error('Tests must not authenticate.'); },
    isCustomCloud: false,
    environment: {
        name: 'Test cloud',
        portalUrl: 'https://portal.example.test',
        managementEndpointUrl: 'https://management.example.test',
        resourceManagerEndpointUrl: 'https://management.example.test',
        activeDirectoryEndpointUrl: 'https://login.example.test',
        activeDirectoryResourceId: 'https://management.example.test',
        validateAuthority: true
    }
};

class TestSiteClient extends SiteClient {
    public data = Uint8Array.from([0, 0, 1, 0, 0x80, 0xff, 0xc3, 0x28]);
    public etag = '"initial"';
    public uploads: { data: string | ArrayBuffer | Uint8Array, url: string, etag: string | undefined }[] = [];
    public writeError: Error | undefined;

    public override async vfsGetItem(_context: IActionContext, url: string): Promise<PipelineResponse> {
        return {
            request: createPipelineRequest({ url }),
            status: 200,
            headers: createHttpHeaders({ etag: this.etag }),
            bodyAsText: Buffer.from(this.data).toString('utf8'),
            readableStreamBody: Readable.from([Buffer.from(this.data)])
        };
    }

    public override async vfsPutItem(_context: IActionContext, data: string | ArrayBuffer | Uint8Array, url: string, headers?: Record<string, string>): Promise<PipelineResponse> {
        this.uploads.push({ data, url, etag: headers?.['If-Match'] });
        if (this.writeError) {
            throw this.writeError;
        }
        this.etag = '"updated"';
        return { request: createPipelineRequest({ url }), status: 200, headers: createHttpHeaders({ etag: this.etag }) };
    }
}

class TestFileSystem extends AppServiceFileSystem {
    public openedItem: FileSystemItem | undefined;

    public override async showFile(item: FileSystemItem): Promise<void> {
        this.openedItem = item;
    }

    public override async showTextDocument(): Promise<void> {
        assert.fail('Files must use generic editor dispatch, not force the text editor.');
    }
}

suite('App Service binary files', () => {
    let fileSystem: TestFileSystem;
    let originalFileSystem: AppServiceFileSystem;
    let tree: AzExtTreeDataProvider;
    let root: GenericParentTreeItem;
    let originalSavePrompt: boolean | undefined;

    setup(async () => {
        originalFileSystem = ext.fileSystem;
        originalSavePrompt = getGlobalSetting<boolean>('showSavePrompt');
        await updateGlobalSetting('showSavePrompt', false);
        root = new GenericParentTreeItem(undefined, { label: 'Test account', id: 'account/cloud', contextValue: 'test' });
        tree = new AzExtTreeDataProvider(root, 'test.loadMore');
        fileSystem = new TestFileSystem(tree);
        ext.fileSystem = fileSystem;
    });

    teardown(async () => {
        ext.fileSystem = originalFileSystem;
        tree.dispose();
        await updateGlobalSetting('showSavePrompt', originalSavePrompt);
    });

    function createFile(label = 'favicon.ico', siteName = 'site', isReadOnly = false): { node: FileSystemItem, client: TestSiteClient } {
        const id = `/subscriptions/subscription/resourceGroups/group/providers/Microsoft.Web/sites/${siteName.replace('/', '/slots/')}`;
        const site = new ParsedSite({
            id, name: siteName, resourceGroup: 'group', location: 'westus', kind: 'app',
            serverFarmId: '/subscriptions/subscription/resourceGroups/group/providers/Microsoft.Web/serverfarms/plan',
            defaultHostName: 'site.example.test', hostNameSslStates: []
        }, subscription);
        const client = new TestSiteClient(new WebSiteManagementClient(subscription.credentials, subscription.subscriptionId), site);
        site.createClient = async () => client;
        const parent = new GenericParentTreeItem(root, { label: siteName, id, contextValue: 'test' });
        const folder = new FolderTreeItem(parent, { site, label: 'wwwroot', url: 'https://site.example.test/api/vfs/site/wwwroot/', isReadOnly });
        const node = new FileTreeItem(folder, site, label, `${folder.url}${label}`, isReadOnly);
        return { node: Object.assign(node, { id: node.fullId }), client };
    }

    test('Preserves non-UTF8 binary bytes', async () => {
        const { node, client } = createFile();
        const actual = await fileSystem.readFileImpl(await createTestActionContext(), node);
        assert.deepStrictEqual(Buffer.from(actual), Buffer.from(client.data));
        assert.notDeepStrictEqual(Buffer.from(actual), Buffer.from(Buffer.from(client.data).toString('utf8')));
    });

    test('Preserves ordinary UTF8 text', async () => {
        const { node, client } = createFile('index.html');
        client.data = Buffer.from('<html>Hello \u4e16\u754c</html>\r\n');
        const actual = await fileSystem.readFileImpl(await createTestActionContext(), node);
        assert.deepStrictEqual(Buffer.from(actual), client.data);
    });

    test('Opens a valid favicon.ico in the real image editor with byte-exact provider data', async function (this: Mocha.Context): Promise<void> {
        if (!extensions.getExtension('vscode.media-preview')) {
            console.warn('Skipping ICO editor integration: this VS Code build does not include vscode.media-preview.');
            this.skip();
        }
        const { node, client } = createFile();
        const icon = Buffer.alloc(70);
        icon.writeUInt16LE(1, 2); // ICO file type
        icon.writeUInt16LE(1, 4); // One image
        icon[6] = icon[7] = 1;
        icon.writeUInt16LE(1, 10);
        icon.writeUInt16LE(32, 12);
        icon.writeUInt32LE(48, 14);
        icon.writeUInt32LE(22, 18);
        icon.writeUInt32LE(40, 22); // BITMAPINFOHEADER
        icon.writeInt32LE(1, 26);
        icon.writeInt32LE(2, 30); // Pixel data plus transparency mask
        icon.writeUInt16LE(1, 34);
        icon.writeUInt16LE(32, 36);
        icon.writeUInt32LE(8, 42);
        icon[64] = icon[65] = 255; // Opaque red pixel
        client.data = icon;

        const realFileSystem = new AppServiceFileSystem(tree);
        realFileSystem.scheme = 'appservice-binary-test';
        const registration = workspace.registerFileSystemProvider(realFileSystem.scheme, realFileSystem);
        ext.fileSystem = realFileSystem;
        try {
            await showFile(await createTestActionContext(), node);
            const findTab = (): Tab | undefined => window.tabGroups.all.flatMap(group => group.tabs).find(candidate =>
                candidate.input instanceof TabInputCustom && candidate.input.uri.scheme === realFileSystem.scheme);
            const tab = findTab() ?? await new Promise<Tab>((resolve, reject) => {
                const timeout = setTimeout(() => {
                    listener.dispose();
                    reject(new Error('Timed out waiting for the favicon.ico image editor tab.'));
                }, 5000);
                const listener = window.tabGroups.onDidChangeTabs(() => {
                    const openedTab = findTab();
                    if (openedTab) {
                        clearTimeout(timeout);
                        listener.dispose();
                        resolve(openedTab);
                    }
                });
            });
            assert.ok(tab?.input instanceof TabInputCustom, 'favicon.ico should open in a custom editor, not a rejected text editor.');
            assert.strictEqual(tab.input.viewType, 'imagePreview.previewEditor');
            assert.strictEqual(tab.input.uri.path, '/favicon.ico');
            assert.strictEqual(new URLSearchParams(tab.input.uri.query).get('id'), node.id);
            assert.deepStrictEqual(Buffer.from(await workspace.fs.readFile(tab.input.uri)), icon);
        } finally {
            const tabs = window.tabGroups.all.flatMap(group => group.tabs).filter(tab =>
                tab.input instanceof TabInputCustom && tab.input.uri.scheme === realFileSystem.scheme);
            await window.tabGroups.close(tabs);
            registration.dispose();
            ext.fileSystem = fileSystem;
        }
    });

    for (const label of ['favicon.ico', 'index.html']) {
        test(`Uses generic editor dispatch for ${label} without replacing resource identity`, async () => {
            const { node } = createFile(label);
            const expectedId = node.fullId;
            const expectedUrl = node.url;
            await showFile(await createTestActionContext(), node);
            assert.strictEqual(fileSystem.openedItem, node);
            assert.strictEqual(node.id, expectedId);
            assert.strictEqual(node.url, expectedUrl);
        });
    }

    test('Retains shared readonly routing', async () => {
        const { node } = createFile('favicon.ico', 'site', true);
        const context = await createTestActionContext();
        let opened = false;
        node.openReadOnly = async actualContext => {
            assert.strictEqual(actualContext, context);
            opened = true;
        };
        await showFile(context, node);
        assert.strictEqual(opened, true);
        assert.strictEqual(fileSystem.openedItem, undefined);
    });

    test('Keeps ETags isolated by full identity and refreshes them after writes', async () => {
        const first = createFile();
        const second = createFile('favicon.ico', 'site/staging');
        second.client.etag = '"slot"';
        const context = await createTestActionContext();
        first.node.refresh = second.node.refresh = async () => undefined;
        await fileSystem.readFileImpl(context, first.node);
        await fileSystem.readFileImpl(context, second.node);
        const uri = Uri.parse('azureAppService:/favicon.ico');
        await fileSystem.writeFileImpl(context, first.node, first.client.data, uri);
        await fileSystem.writeFileImpl(context, second.node, second.client.data, uri);
        await fileSystem.writeFileImpl(context, first.node, first.client.data, uri);
        assert.deepStrictEqual(first.client.uploads.map(upload => upload.etag), ['"initial"', '"updated"']);
        assert.strictEqual(second.client.uploads[0].etag, '"slot"');
        assert.strictEqual(first.client.uploads[0].data, first.client.data);
        assert.strictEqual(first.client.uploads[0].url, first.node.url);
    });

    test('Preserves actionable ETag conflict errors', async () => {
        const { node, client } = createFile();
        const context = await createTestActionContext();
        await fileSystem.readFileImpl(context, node);
        client.writeError = Object.assign(new Error('ETag mismatch'), { code: '412' });
        await assert.rejects(fileSystem.writeFileImpl(context, node, client.data, Uri.parse('azureAppService:/favicon.ico')),
            /ETag does not represent the latest state.*favicon.ico/);
    });

    test('Cancelling the save prompt does not upload bytes', async () => {
        const { node, client } = createFile();
        const context = await createTestActionContext();
        await fileSystem.readFileImpl(context, node);
        await updateGlobalSetting('showSavePrompt', true);
        await context.ui.runWithInputs([DialogResponses.dontUpload.title], async () => {
            await assert.rejects(fileSystem.writeFileImpl(context, node, client.data, Uri.parse('azureAppService:/favicon.ico')),
                UserCancelledError);
        });
        assert.strictEqual(client.uploads.length, 0);
    });
});
