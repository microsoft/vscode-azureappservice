/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as assert from 'assert';
import { IActionContext } from 'vscode-azureextensionui';
import { checkForRemoteDebugSupport } from '../../extension.bundle';

suite('checkForRemoteDebugSupport', () => {
    function getEmptyActionContext(): IActionContext {
        return {
            measurements: {},
            properties: {}
        };
    }

    test('Checks bad versions', async () => {
        const actionContext = getEmptyActionContext();

        // empty version
        assert.throws(() => { checkForRemoteDebugSupport({}, actionContext); }, Error);
        assert.throws(() => { checkForRemoteDebugSupport({ linuxFxVersion: undefined }, actionContext); }, Error);
        assert.throws(() => { checkForRemoteDebugSupport({ linuxFxVersion: '' }, actionContext); }, Error);
        assert.throws(() => { checkForRemoteDebugSupport({ linuxFxVersion: ' ' }, actionContext); }, Error);

        // not node
        assert.throws(() => { checkForRemoteDebugSupport({ linuxFxVersion: 'php' }, actionContext); }, Error);
        assert.throws(() => { checkForRemoteDebugSupport({ linuxFxVersion: 'PYTHON|8.11' }, actionContext); }, Error);
        assert.throws(() => { checkForRemoteDebugSupport({ linuxFxVersion: 'docker|image' }, actionContext); }, Error);

        // bad node versions
        assert.throws(() => { checkForRemoteDebugSupport({ linuxFxVersion: 'NODE' }, actionContext); }, Error);
        assert.throws(() => { checkForRemoteDebugSupport({ linuxFxVersion: 'node|9' }, actionContext); }, Error);
        assert.throws(() => { checkForRemoteDebugSupport({ linuxFxVersion: 'NODE|6.12' }, actionContext); }, Error);
        assert.throws(() => { checkForRemoteDebugSupport({ linuxFxVersion: 'node|8.10' }, actionContext); }, Error);
    });

    test('Checks good versions', async () => {
        const actionContext = getEmptyActionContext();

        // >= 8.11 is valid
        checkForRemoteDebugSupport({ linuxFxVersion: 'node|8.11' }, actionContext);
        checkForRemoteDebugSupport({ linuxFxVersion: 'NODE|8.12' }, actionContext);
        checkForRemoteDebugSupport({ linuxFxVersion: 'node|9.0' }, actionContext);
        checkForRemoteDebugSupport({ linuxFxVersion: 'NODE|10.11' }, actionContext);
    });

    test('Reports telemetry correctly', async () => {
        const actionContext = getEmptyActionContext();

        checkForRemoteDebugSupport({ linuxFxVersion: 'NODE|8.11' }, actionContext);
        assert.equal(actionContext.properties.linuxFxVersion, 'node|8.11');

        // Docker image information should be removed from telemetry
        try {
            checkForRemoteDebugSupport({ linuxFxVersion: 'docker|image' }, actionContext);
        } catch (e) {
            // ignore error
        }
        assert.equal(actionContext.properties.linuxFxVersion, 'docker');
    });
});
