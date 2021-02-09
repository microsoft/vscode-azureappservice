/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as assert from 'assert';
import { RemoteDebugLanguage } from 'vscode-azureappservice';
import { getRemoteDebugLanguage } from '../../extension.bundle';
import { createTestContext } from '../global.test';
import { runWithExtensionSetting } from '../runWithSetting';

suite('getRemoteDebugLanguage', () => {
    test('Throws error for bad versions', () => {
        const context = createTestContext();

        // empty version
        assert.throws(() => { getRemoteDebugLanguage({}, context); }, Error);
        assert.throws(() => { getRemoteDebugLanguage({ linuxFxVersion: undefined }, context); }, Error);
        assert.throws(() => { getRemoteDebugLanguage({ linuxFxVersion: '' }, context); }, Error);
        assert.throws(() => { getRemoteDebugLanguage({ linuxFxVersion: ' ' }, context); }, Error);

        // not node
        assert.throws(() => { getRemoteDebugLanguage({ linuxFxVersion: 'php' }, context); }, Error);
        assert.throws(() => { getRemoteDebugLanguage({ linuxFxVersion: 'JAVA|8.11' }, context); }, Error);
        assert.throws(() => { getRemoteDebugLanguage({ linuxFxVersion: 'docker|image' }, context); }, Error);

        // bad node versions
        assert.throws(() => { getRemoteDebugLanguage({ linuxFxVersion: 'NODE' }, context); }, Error);
        assert.throws(() => { getRemoteDebugLanguage({ linuxFxVersion: 'node|9' }, context); }, Error);
        assert.throws(() => { getRemoteDebugLanguage({ linuxFxVersion: 'node|not.number' }, context); }, Error);
        assert.throws(() => { getRemoteDebugLanguage({ linuxFxVersion: 'NODE|6.12' }, context); }, Error);
        assert.throws(() => { getRemoteDebugLanguage({ linuxFxVersion: 'node|8.10' }, context); }, Error);
        assert.throws(() => { getRemoteDebugLanguage({ linuxFxVersion: 'node|6-lts' }, context); }, Error);
    });

    test('Returns language for good versions', () => {
        const context = createTestContext();

        // >= 8.11 is valid
        assert.strictEqual(getRemoteDebugLanguage({ linuxFxVersion: 'node|8.11' }, context), RemoteDebugLanguage.Node);
        assert.strictEqual(getRemoteDebugLanguage({ linuxFxVersion: 'NODE|8.12' }, context), RemoteDebugLanguage.Node);
        assert.strictEqual(getRemoteDebugLanguage({ linuxFxVersion: 'node|9.0' }, context), RemoteDebugLanguage.Node);
        assert.strictEqual(getRemoteDebugLanguage({ linuxFxVersion: 'NODE|10.11' }, context), RemoteDebugLanguage.Node);
        assert.strictEqual(getRemoteDebugLanguage({ linuxFxVersion: 'NODE|lts' }, context), RemoteDebugLanguage.Node);
        assert.strictEqual(getRemoteDebugLanguage({ linuxFxVersion: 'node|8-lts' }, context), RemoteDebugLanguage.Node);
        assert.strictEqual(getRemoteDebugLanguage({ linuxFxVersion: 'node|12-lts' }, context), RemoteDebugLanguage.Node);
    });

    test('Respects the python remote debugging experimental flag', async () => {
        const context = createTestContext();

        // eslint-disable-next-line @typescript-eslint/require-await
        await runWithExtensionSetting('enablePythonRemoteDebugging', undefined, async () => {
            assert.throws(() => { getRemoteDebugLanguage({ linuxFxVersion: 'python|2.7' }, context); }, Error);
            assert.throws(() => { getRemoteDebugLanguage({ linuxFxVersion: 'PYTHON|3.7' }, context); }, Error);
        });

        // eslint-disable-next-line @typescript-eslint/require-await
        await runWithExtensionSetting('enablePythonRemoteDebugging', 'true', async () => {
            assert.strictEqual(getRemoteDebugLanguage({ linuxFxVersion: 'python|2.7' }, context), RemoteDebugLanguage.Python);
            assert.strictEqual(getRemoteDebugLanguage({ linuxFxVersion: 'PYTHON|3.7' }, context), RemoteDebugLanguage.Python);
        });
    });

    test('Reports telemetry correctly', () => {
        const context = createTestContext();

        getRemoteDebugLanguage({ linuxFxVersion: 'NODE|8.11' }, context);
        assert.strictEqual(context.telemetry.properties.linuxFxVersion, 'node|8.11');

        // Docker image information should be removed from telemetry
        try {
            getRemoteDebugLanguage({ linuxFxVersion: 'docker|image' }, context);
        } catch (e) {
            // ignore error
        }
        assert.strictEqual(context.telemetry.properties.linuxFxVersion, 'docker');
    });
});
