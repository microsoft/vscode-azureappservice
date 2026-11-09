/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { type WebSiteManagementClient } from '@azure/arm-appservice';
import { type OperationArguments, type OperationSpec } from '@azure/core-client';
import { type ParsedSite } from '@microsoft/vscode-azext-azureappservice';
import { AzExtTreeDataProvider, GenericParentTreeItem, TestOutputChannel, UserCancelledError, createTestActionContext, testGlobalSetup, type IActionContext, type ISubscriptionContext } from '@microsoft/vscode-azext-utils';
import * as assert from 'assert';
import { restartWebApp } from '../src/commands/restartWebApp';
import { ext } from '../src/extensionVariables';
import { SiteTreeItem } from '../src/tree/SiteTreeItem';
import { getResourceGroupsApi } from '../src/utils/getExtensionApi';

const subscription: ISubscriptionContext = {
    subscriptionId: 'subscription',
    subscriptionPath: '/subscriptions/subscription',
    subscriptionDisplayName: 'Test subscription',
    tenantId: 'tenant',
    userId: 'account',
    credentials: { getToken: async () => { throw new Error('Tests must not authenticate.'); } },
    createCredentialsForScopes: async () => { throw new Error('Tests must not authenticate.'); },
    isCustomCloud: true,
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

class TestSiteTreeItem extends SiteTreeItem {
    public initialized = false;
    public refreshCount = 0;
    public initError: Error | undefined;

    public override async initSite(context: IActionContext): Promise<void> {
        if (this.initError) {
            throw this.initError;
        }
        await super.initSite(context);
        this.initialized = true;
    }

    public override get site(): ParsedSite {
        assert.ok(this.initialized, 'Restart must initialize the site before accessing it.');
        return super.site;
    }

    public override async refreshImpl(): Promise<void> {
        this.refreshCount++;
    }
}

class RestartOutputChannel extends TestOutputChannel {
    public messages: string[] = [];

    public override appendLog(value: string): void {
        this.messages.push(value);
    }
}

suite('Restart web app', () => {
    let root: GenericParentTreeItem;
    let tree: AzExtTreeDataProvider;
    let output: RestartOutputChannel;
    let originalOutput: typeof ext.outputChannel;
    let originalPick: typeof ext.rgApi.pickAppResource;
    let clientPrototype: object;
    let originalRequest: PropertyDescriptor | undefined;
    let originalRgApi: typeof ext.rgApi;
    let requests: string[][];
    let restartError: Error | undefined;

    suiteSetup(async () => {
        testGlobalSetup();
        originalRgApi = ext.rgApi;
        ext.rgApi = { ...await getResourceGroupsApi() };
    });

    suiteTeardown(() => {
        ext.rgApi = originalRgApi;
    });

    setup(async () => {
        root = new GenericParentTreeItem(undefined, { label: 'Test subscription', id: 'subscription', contextValue: 'test' });
        Object.defineProperty(root, 'subscription', { value: subscription });
        tree = new AzExtTreeDataProvider(root, 'test.loadMore');
        requests = [];
        restartError = undefined;
        clientPrototype = (await import('@azure/arm-appservice')).WebSiteManagementClient.prototype;
        originalRequest = Object.getOwnPropertyDescriptor(clientPrototype, 'sendOperationRequest');
        Object.defineProperty(clientPrototype, 'sendOperationRequest', {
            configurable: true,
            writable: true,
            value: async function (this: WebSiteManagementClient, args: OperationArguments, spec: OperationSpec) {
                assert.strictEqual(this.subscriptionId, subscription.subscriptionId);
                const endpointPolicy = this.pipeline.getOrderedPolicies().find(policy => policy.name === 'AddEndpointPolicy');
                assert.ok(endpointPolicy && 'endpoint' in endpointPolicy);
                assert.strictEqual(endpointPolicy.endpoint, subscription.environment.resourceManagerEndpointUrl);
                assert.strictEqual(spec.httpMethod, 'POST');
                assert.ok(spec.path?.endsWith('/restart'), 'Restart must not stop or start the app separately.');
                assert.ok(typeof args.resourceGroupName === 'string');
                assert.ok(typeof args.name === 'string');
                if (args.slot) {
                    assert.ok(typeof args.slot === 'string');
                    requests.push(['restartSlot', args.resourceGroupName, args.name, args.slot]);
                } else {
                    requests.push(['restart', args.resourceGroupName, args.name]);
                }
                if (restartError) {
                    throw restartError;
                }
            }
        });
        originalOutput = ext.outputChannel;
        output = new RestartOutputChannel();
        ext.outputChannel = output;
        originalPick = ext.rgApi.pickAppResource;
        ext.rgApi.pickAppResource = async () => {
            assert.fail('Tree actions must not prompt for a different app.');
        };
    });

    teardown(() => {
        if (originalRequest) {
            Object.defineProperty(clientPrototype, 'sendOperationRequest', originalRequest);
        } else {
            Reflect.deleteProperty(clientPrototype, 'sendOperationRequest');
        }
        ext.rgApi.pickAppResource = originalPick;
        ext.outputChannel = originalOutput;
        output.dispose();
        tree.dispose();
    });

    function createNode(slot?: string): TestSiteTreeItem {
        return new TestSiteTreeItem(root, {
            id: `/subscriptions/subscription/resourceGroups/group/providers/Microsoft.Web/sites/site${slot ? `/slots/${slot}` : ''}`,
            name: slot ? `site/${slot}` : 'site',
            resourceGroup: 'group',
            location: 'westus',
            kind: 'app',
            state: 'Running',
            serverFarmId: '/subscriptions/subscription/resourceGroups/group/providers/Microsoft.Web/serverfarms/plan',
            defaultHostName: 'site.example.test',
            hostNameSslStates: []
        });
    }

    for (const slot of [undefined, 'staging']) {
        test(`Uses native restart for ${slot ? 'a deployment slot' : 'production'}`, async () => {
            const node = createNode(slot);
            await restartWebApp(await createTestActionContext(), node);
            assert.deepStrictEqual(requests, [slot ? ['restartSlot', 'group', 'site', slot] : ['restart', 'group', 'site']]);
            assert.strictEqual(node.refreshCount, 1);
            assert.strictEqual(node.description, undefined);
            assert.deepStrictEqual(output.messages, [
                `Restarting "site${slot ? `-${slot}` : ''}"...`,
                `"site${slot ? `-${slot}` : ''}" has been restarted.`
            ]);
        });

        test(`Propagates restart failure for ${slot ? 'a deployment slot' : 'production'} without logging success`, async () => {
            const node = createNode(slot);
            restartError = new Error('Restart failed');
            await assert.rejects(restartWebApp(await createTestActionContext(), node), error => error === restartError);
            assert.strictEqual(requests.length, 1);
            assert.strictEqual(node.refreshCount, 1);
            assert.strictEqual(node.description, undefined);
            assert.strictEqual(output.messages.length, 1);
        });
    }

    test('Restarts the app selected from the command palette', async () => {
        const node = createNode();
        let picked = false;
        Object.defineProperty(ext.rgApi, 'pickAppResource', {
            configurable: true,
            writable: true,
            value: async () => {
                picked = true;
                return node;
            }
        });
        await restartWebApp(await createTestActionContext());
        assert.ok(picked);
        assert.deepStrictEqual(requests, [['restart', 'group', 'site']]);
    });

    test('Does not restart when resource selection is cancelled', async () => {
        const cancellation = new UserCancelledError();
        ext.rgApi.pickAppResource = async () => { throw cancellation; };
        await assert.rejects(restartWebApp(await createTestActionContext()), error => error === cancellation);
        assert.deepStrictEqual(requests, []);
    });

    test('Does not create a client or log success when initialization fails', async () => {
        const node = createNode();
        node.initError = new Error('Initialization failed');
        await assert.rejects(restartWebApp(await createTestActionContext(), node), error => error === node.initError);
        assert.deepStrictEqual(requests, []);
        assert.deepStrictEqual(output.messages, []);
    });
});
