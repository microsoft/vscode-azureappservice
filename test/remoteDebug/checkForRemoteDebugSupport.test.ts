/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as assert from 'assert';
import { IActionContext } from 'vscode-azureextensionui';
import { checkForRemoteDebugSupport } from '../../extension.bundle';

suite('checkForRemoteDebugSupport', () => {
    function getEmptycontext(): IActionContext {
        return {
            telemetry: {
                properties: {},
                measurements: {}
            },
            errorHandling: {}
        };
    }

    test('Checks bad versions', async () => {
        const context = getEmptycontext();

        // empty version
        assert.throws(() => { checkForRemoteDebugSupport({}, context); }, Error);
        assert.throws(() => { checkForRemoteDebugSupport({ linuxFxVersion: undefined }, context); }, Error);
        assert.throws(() => { checkForRemoteDebugSupport({ linuxFxVersion: '' }, context); }, Error);
        assert.throws(() => { checkForRemoteDebugSupport({ linuxFxVersion: ' ' }, context); }, Error);

        // not node
        assert.throws(() => { checkForRemoteDebugSupport({ linuxFxVersion: 'php' }, context); }, Error);
        assert.throws(() => { checkForRemoteDebugSupport({ linuxFxVersion: 'PYTHON|8.11' }, context); }, Error);
        assert.throws(() => { checkForRemoteDebugSupport({ linuxFxVersion: 'docker|image' }, context); }, Error);

        // bad node versions
        assert.throws(() => { checkForRemoteDebugSupport({ linuxFxVersion: 'NODE' }, context); }, Error);
        assert.throws(() => { checkForRemoteDebugSupport({ linuxFxVersion: 'node|9' }, context); }, Error);
        assert.throws(() => { checkForRemoteDebugSupport({ linuxFxVersion: 'node|not.number' }, context); }, Error);
        assert.throws(() => { checkForRemoteDebugSupport({ linuxFxVersion: 'NODE|6.12' }, context); }, Error);
        assert.throws(() => { checkForRemoteDebugSupport({ linuxFxVersion: 'node|8.10' }, context); }, Error);
    });

    test('Checks good versions', async () => {
        const context = getEmptycontext();

        // >= 8.11 is valid
        checkForRemoteDebugSupport({ linuxFxVersion: 'node|8.11' }, context);
        checkForRemoteDebugSupport({ linuxFxVersion: 'NODE|8.12' }, context);
        checkForRemoteDebugSupport({ linuxFxVersion: 'node|9.0' }, context);
        checkForRemoteDebugSupport({ linuxFxVersion: 'NODE|10.11' }, context);
    });

    test('Reports telemetry correctly', async () => {
        const context = getEmptycontext();

        checkForRemoteDebugSupport({ linuxFxVersion: 'NODE|8.11' }, context);
        assert.equal(context.telemetry.properties.linuxFxVersion, 'node|8.11');

        // Docker image information should be removed from telemetry
        try {
            checkForRemoteDebugSupport({ linuxFxVersion: 'docker|image' }, context);
        } catch (e) {
            // ignore error
        }
        assert.equal(context.telemetry.properties.linuxFxVersion, 'docker');
    });
});
