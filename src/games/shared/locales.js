/* global kiwi:true */

/**
 * Chargeur de locales pour les plugins kiwi-games.
 * Calqué sur le pattern du plugin-asl : charge les bundles JSON depuis
 * `localesPath/<lang>.json` et les enregistre auprès de kiwi.i18n sous
 * le namespace donné. Lance également le chargement du fallback en-us.
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
 * Résout le chemin de base à partir duquel le plugin a été chargé afin
 * de construire l'URL des fichiers de locales. Identique à l'astuce
 * utilisée dans plugin-asl.
 */
export function getPluginBasePath() {
    const scripts = document.getElementsByTagName('script');
    if (!scripts.length) return '';
    const scriptPath = scripts[scripts.length - 1].src || '';
    return scriptPath.substr(0, scriptPath.lastIndexOf('/') + 1);
}

/**
 * Raccourci de traduction pour le code JS (hors composants Vue).
 * Préfixe automatiquement la clé avec le namespace 'kiwi-games:'.
 * Dans les templates Vue, utiliser directement $t('kiwi-games:<clé>').
 *
 * @param {string} key - Clé de traduction (sans le préfixe namespace).
 * @param {object} [options] - Paramètres d'interpolation i18next.
 * @returns {string}
 */
export function t(key, options) {
    if (!kiwi.i18n) return key;
    return kiwi.i18n.t('kiwi-games:' + key, options);
}
