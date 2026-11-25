/* global kiwi:true */

/**
 * Locale loader for the kiwi-games plugins.
 * Same pattern as plugin-asl: load JSON bundles from
 * `localesPath/<lang>.json` and register them on kiwi.i18n under
 * the given namespace. Also loads the en-us fallback.
 */
export default class Locales {
    constructor() {
        this.fallbackLocale = null;
        this.localesPath = '';
        this.nameSpace = '';
        this.testKey = '';
    }

    init(localesPath, nameSpace, testKey) {
        this.localesPath = localesPath;
        this.nameSpace = nameSpace;
        this.testKey = testKey;

        kiwi.i18n.on('languageChanged', (lang) => {
            if (kiwi.i18n.getResource(lang, this.nameSpace, this.testKey)) {
                return;
            }
            this.loadLocale(lang);
        });

        if (kiwi.i18n.language !== 'en-us') {
            this.loadLocale('en-us');
        }
        this.loadLocale(kiwi.i18n.language);
    }

    loadLocale(_lang) {
        const lang = _lang.toLowerCase();
        const xhttp = new XMLHttpRequest();
        xhttp.onload = () => {
            if (xhttp.status !== 200) {
                this.applyLocale(lang, null);
                return;
            }
            try {
                this.applyLocale(lang, JSON.parse(xhttp.responseText));
            } catch (_) {
                this.applyLocale(lang, null);
            }
        };
        xhttp.open('GET', this.localesPath + '/' + lang + '.json');
        xhttp.send();
    }

    applyLocale(lang, localeData) {
        if (!this.fallbackLocale && lang === 'en-us') {
            this.fallbackLocale = localeData;
        }
        kiwi.i18n.addResourceBundle(lang, this.nameSpace, localeData || this.fallbackLocale);
    }
}

/**
 * Resolves the base path the plugin was loaded from, used to build
 * locale file URLs. Same trick as plugin-asl.
 */
export function getPluginBasePath() {
    const current = typeof document !== 'undefined'
        && document.currentScript
        && document.currentScript.src;
    let scriptPath = current || '';
    if (!scriptPath) {
        const scripts = document.getElementsByTagName('script');
        if (!scripts.length) return '';
        scriptPath = scripts[scripts.length - 1].src || '';
    }
    if (!scriptPath) return '';
    return scriptPath.slice(0, scriptPath.lastIndexOf('/') + 1);
}

/**
 * Translation helper for JS code (outside Vue components).
 * Prefixes the key with the 'kiwi-games:' namespace.
 * In Vue templates, use $t('kiwi-games:<key>') directly.
 *
 * @param {string} key - Translation key (without the namespace prefix).
 * @param {object} [options] - i18next interpolation parameters.
 * @returns {string}
 */
export function t(key, options) {
    if (!kiwi.i18n) return key;
    return kiwi.i18n.t('kiwi-games:' + key, options);
}
