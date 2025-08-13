/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as assert from 'assert';
import { TestUserInput } from '@microsoft/vscode-azext-dev';
import * as vscode from 'vscode';
import { CustomAppServicePlanSkuStep } from '../src/commands/createWebApp/CustomAppServicePlanSkuStep';

suite('CustomAppServicePlanSkuStep', function (this: Mocha.Suite) {
    this.timeout(120 * 1000);

    test('should prompt for basic mode', async () => {
        const step = new CustomAppServicePlanSkuStep();
        const context = {
            advancedCreation: false,
            newPlanSku: undefined,
            ui: new TestUserInput(vscode),
            telemetry: { properties: {}, measurements: {} },
            valuesToMask: [],
            credentials: {
                getToken: () => Promise.resolve({ token: undefined })
            },
            environment: {
                resourceManagerEndpointUrl: 'https://management.azure.com/'
            },
            subscriptionId: 'test-subscription-id'
        } as any;

        // Mock UI input to select the first SKU option
        context.ui.inputsAreExactlyPartOf(['F1']);

        assert.strictEqual(step.shouldPrompt(context), true, 'Should prompt when newPlanSku is undefined');

        // This test verifies the step can be instantiated and basic logic works
        // In a real test environment, you would need full Azure credentials to test the API call
    });

    test('should not prompt when newPlanSku is already set', () => {
        const step = new CustomAppServicePlanSkuStep();
        const context = {
            newPlanSku: { name: 'F1', tier: 'Free' }
        } as any;

        assert.strictEqual(step.shouldPrompt(context), false, 'Should not prompt when newPlanSku is set');
    });

    test('getRecommendedSkus should include expected SKUs', () => {
        const step = new CustomAppServicePlanSkuStep();
        
        // Access private method for testing
        const getRecommendedSkus = (step as any).getRecommendedSkus.bind(step);
        
        // Set region capabilities to false to test V3 fallback
        (step as any)._supportsPV4 = false;
        (step as any)._supportsMV4 = false;
        
        const skus = getRecommendedSkus();
        
        assert.ok(skus.length > 0, 'Should return at least one SKU');
        assert.ok(skus.some((s: any) => s.name === 'F1'), 'Should include F1 SKU');
        assert.ok(skus.some((s: any) => s.name === 'B1'), 'Should include B1 SKU');
        assert.ok(skus.some((s: any) => s.name === 'P0V3'), 'Should include P0V3 SKU when V4 not supported');
        assert.ok(skus.some((s: any) => s.name === 'P1V3'), 'Should include P1V3 SKU when V4 not supported');
        
        // Verify V4 SKUs are not present when not supported
        assert.ok(!skus.some((s: any) => s.name === 'P0V4'), 'Should not include P0V4 SKU when V4 not supported');
    });

    test('getRecommendedSkus should include V4 SKUs when supported', () => {
        const step = new CustomAppServicePlanSkuStep();
        
        // Access private method for testing
        const getRecommendedSkus = (step as any).getRecommendedSkus.bind(step);
        
        // Set region capabilities to true
        (step as any)._supportsPV4 = true;
        (step as any)._supportsMV4 = true;
        
        const skus = getRecommendedSkus();
        
        assert.ok(skus.length > 0, 'Should return at least one SKU');
        assert.ok(skus.some((s: any) => s.name === 'F1'), 'Should include F1 SKU');
        assert.ok(skus.some((s: any) => s.name === 'B1'), 'Should include B1 SKU');
        assert.ok(skus.some((s: any) => s.name === 'P0V4'), 'Should include P0V4 SKU when V4 supported');
        assert.ok(skus.some((s: any) => s.name === 'P1V4'), 'Should include P1V4 SKU when V4 supported');
        assert.ok(skus.some((s: any) => s.name === 'P1MV4'), 'Should include P1MV4 SKU when MV4 supported');
        
        // Verify recommended group is set
        const recommendedSkus = skus.filter((s: any) => s.group && s.group.includes('Recommended'));
        assert.ok(recommendedSkus.length > 0, 'Should have recommended group SKUs');
    });

    test('getAdvancedSkus should include legacy V2 SKUs', () => {
        const step = new CustomAppServicePlanSkuStep();
        
        // Access private method for testing
        const getAdvancedSkus = (step as any).getAdvancedSkus.bind(step);
        
        const skus = getAdvancedSkus();
        
        assert.ok(skus.length > 0, 'Should return at least one SKU');
        
        // Verify legacy V2 SKUs are in advanced (deprioritized)
        assert.ok(skus.some((s: any) => s.name === 'P1v2'), 'Should include P1v2 SKU in advanced');
        assert.ok(skus.some((s: any) => s.name === 'P2v2'), 'Should include P2v2 SKU in advanced');
        assert.ok(skus.some((s: any) => s.name === 'P3v2'), 'Should include P3v2 SKU in advanced');
        
        // Verify basic tiers are included
        assert.ok(skus.some((s: any) => s.name === 'B2'), 'Should include B2 SKU in advanced');
        assert.ok(skus.some((s: any) => s.name === 'B3'), 'Should include B3 SKU in advanced');
        
        // Verify standard tiers are included  
        assert.ok(skus.some((s: any) => s.name === 'S1'), 'Should include S1 SKU in advanced');
        assert.ok(skus.some((s: any) => s.name === 'S2'), 'Should include S2 SKU in advanced');
        assert.ok(skus.some((s: any) => s.name === 'S3'), 'Should include S3 SKU in advanced');
    });
});