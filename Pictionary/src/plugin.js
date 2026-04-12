import { init } from './index.js';

// eslint-disable-next-line no-undef
kiwi.plugin('pictionary', (kiwi) => init(kiwi, { button: true, command: true }));
