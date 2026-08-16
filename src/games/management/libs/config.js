import { defaultConfig } from './constants.js';

let runtimeConfig = { ...defaultConfig };

export function setConfig(config = {}) {
    runtimeConfig = { ...defaultConfig, ...config };
}

export function getConfig() {
    return runtimeConfig;
}
