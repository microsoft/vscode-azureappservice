/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

export interface RotatingPricingTier {
    name: string | RegExp;
    family: string;
}

const pricingTiers: RotatingPricingTier[] = [
    { name: /P1v2/, family: "Pv2" },
    { name: 'P2v2', family: "Pv2" },
    { name: 'P3v2', family: "Pv2" },
    { name: /B1/, family: "B" },
    { name: 'B2', family: "B" },
    { name: 'B3', family: "B" },
    { name: 'S1', family: "S" },
    { name: 'S2', family: "S" },
    { name: 'S3', family: "S" },
];

let pricingTierCount: number = getStartingIndex();
export function getRotatingPricingTier(): RotatingPricingTier {
    pricingTierCount += 1;
    return pricingTiers[pricingTierCount % pricingTiers.length];
}

const locations: string[] = ['Australia East', 'East Asia', 'East US', 'North Europe', 'South Central US', 'Southeast Asia', 'UK South', 'West Europe'];
let locationCount: number = getStartingIndex();
export function getRotatingLocation(): string {
    locationCount += 1;
    return locations[locationCount % locations.length];
}


let zoneRedundancyCount: number = getStartingIndex();
const zoneRedundancyEnablement: string[] = ['Enabled', 'Disabled'];
export function getRotatingZoneRedundancyEnablement(): string {
    zoneRedundancyCount += 1;
    return zoneRedundancyEnablement[zoneRedundancyCount % zoneRedundancyEnablement.length];
}

/**
 * Adds a little more spice to the rotation
 */
function getStartingIndex(): number {
    if (process.platform === 'darwin') {
        return 0;
    } else if (process.platform === 'win32') {
        return 1;
    } else {
        return 2;
    }
}
