/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as assert from 'assert';
import { RemoteDebugLanguage } from 'vscode-azureappservice';
import { IActionContext } from 'vscode-azureextensionui';
import { getRemoteDebugLanguage } from '../../extension.bundle';
import { runWithExtensionSetting } from '../runWithSetting';

suite('getRemoteDebugLanguage', () => {
    function getEmptycontext(): IActionContext {
        return {
            telemetry: {
                properties: {},
                measurements: {}
            },
            errorHandling: {
                issueProperties: {}
            }
        };
    }

    test('Throws error for bad versions', async () => {
        const context = getEmptycontext();

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

    test('Returns language for good versions', async () => {
        const context = getEmptycontext();

        // >= 8.11 is valid
        assert.equal(getRemoteDebugLanguage({ linuxFxVersion: 'node|8.11' }, context), RemoteDebugLanguage.Node);
        assert.equal(getRemoteDebugLanguage({ linuxFxVersion: 'NODE|8.12' }, context), RemoteDebugLanguage.Node);
        assert.equal(getRemoteDebugLanguage({ linuxFxVersion: 'node|9.0' }, context), RemoteDebugLanguage.Node);
        assert.equal(getRemoteDebugLanguage({ linuxFxVersion: 'NODE|10.11' }, context), RemoteDebugLanguage.Node);
        assert.equal(getRemoteDebugLanguage({ linuxFxVersion: 'NODE|lts' }, context), RemoteDebugLanguage.Node);
        assert.equal(getRemoteDebugLanguage({ linuxFxVersion: 'node|8-lts' }, context), RemoteDebugLanguage.Node);
        assert.equal(getRemoteDebugLanguage({ linuxFxVersion: 'node|12-lts' }, context), RemoteDebugLanguage.Node);
    });

    test('Respects the python remote debugging experimental flag', async () => {
        const context = getEmptycontext();

        await runWithExtensionSetting('enablePythonRemoteDebugging', undefined, async () => {
            assert.throws(() => { getRemoteDebugLanguage({ linuxFxVersion: 'python|2.7' }, context); }, Error);
            assert.throws(() => { getRemoteDebugLanguage({ linuxFxVersion: 'PYTHON|3.7' }, context); }, Error);
        });

        await runWithExtensionSetting('enablePythonRemoteDebugging', 'true', async () => {
            assert.equal(getRemoteDebugLanguage({ linuxFxVersion: 'python|2.7' }, context), RemoteDebugLanguage.Python);
            assert.equal(getRemoteDebugLanguage({ linuxFxVersion: 'PYTHON|3.7' }, context), RemoteDebugLanguage.Python);
        });
    });

    test('Reports telemetry correctly', async () => {
        const context = getEmptycontext();

        getRemoteDebugLanguage({ linuxFxVersion: 'NODE|8.11' }, context);
        assert.equal(context.telemetry.properties.linuxFxVersion, 'node|8.11');

        // Docker image information should be removed from telemetry
        try {
            getRemoteDebugLanguage({ linuxFxVersion: 'docker|image' }, context);
        } catch (e) {
            // ignore error
        }
        assert.equal(context.telemetry.properties.linuxFxVersion, 'docker');
    });
});
