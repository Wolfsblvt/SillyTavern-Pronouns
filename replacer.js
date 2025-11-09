import { t } from '../../../../scripts/i18n.js';
import { Popup, POPUP_TYPE, POPUP_RESULT } from '../../../../scripts/popup.js';
import { escapeHtml } from '../../../utils.js';
import { getCurrentPronounValues, getPersonaShorthandSetting, defaultShorthandAliases } from './index.js';

/** @typedef {{ subjective: string, objective: string, posDet: string, posPro: string, reflexive: string }} Pronouns */
/** @typedef {{ pronounKey: 'subjective'|'objective'|'posDet'|'posPro'|'reflexive', names: string[] }} PronounShorthandAlias */

/**
 * Escapes a string for safe use inside a RegExp pattern.
 * @param {string} str
 * @returns {string}
 */
function escapeForRegex(str) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Checks whether all persona pronoun fields are empty.
 * @param {Pronouns} p
 */
function arePronounsEmpty(p) {
    if (!p) return true;
    return [p.subjective, p.objective, p.posDet, p.posPro, p.reflexive]
        .every(v => !v || String(v).trim() === '');
}

/**
 * Selects a shorthand alias name that matches the current pronoun value for the given key.
 * Falls back to null if no matching alias is available.
 * @param {'subjective'|'objective'|'posDet'|'posPro'|'reflexive'} pronounKey
 * @param {string} value
 * @returns {string|null}
 */
function pickMatchingShorthandAlias(pronounKey, value) {
    const aliases = defaultShorthandAliases.find(a => a.pronounKey === pronounKey)?.names ?? [];
    const lower = String(value || '').toLowerCase();
    const match = aliases.find(name => name.toLowerCase().startsWith(lower));
    return match || null;
}

/**
 * Converts direct pronoun words in the provided text into macros for the current persona.
 * Optionally uses shorthand macro names if globally enabled and a matching shorthand exists.
 *
 * Ambiguities (e.g., "her" objective vs possessive determiner, or "his"/"its") are resolved
 * by a fixed precedence: reflexive > possessive pronoun > objective > possessive determiner > subjective.
 *
 * @param {string} text - Input text to convert
 * @param {{ useShorthands?: boolean }} [options]
 * @returns {string}
 */
export function replacePronounsWithMacros(text, { useShorthands = false } = {}) {
    if (!text) return '';

    const pronouns = getCurrentPronounValues();
    if (arePronounsEmpty(pronouns)) {
        toastr.warning(t`No persona pronouns are set. Set pronouns in Persona Management to enable replacement.`);
        return text;
    }
    /** @type {Array<'subjective'|'objective'|'posDet'|'posPro'|'reflexive'>} */
    const precedence = ['reflexive', 'posPro', 'objective', 'posDet', 'subjective'];

    /** @type {Map<string,string>} */
    const lowerWordToMacro = new Map();

    /**
     * @param {'subjective'|'objective'|'posDet'|'posPro'|'reflexive'} key
     * @param {string} value
     */
    function register(key, value) {
        const v = String(value || '').trim();
        if (!v) return;
        const lower = v.toLowerCase();
        if (lowerWordToMacro.has(lower)) return; // keep first by precedence

        let macroName = null;
        if (useShorthands && getPersonaShorthandSetting()) {
            const alias = pickMatchingShorthandAlias(key, v);
            if (alias) macroName = alias;
        }
        if (!macroName) {
            const macroKey = key === 'posDet' ? 'pos_det' : key === 'posPro' ? 'pos_pro' : key;
            macroName = `pronoun.${macroKey}`;
        }
        lowerWordToMacro.set(lower, `{{${macroName}}}`);
    }

    for (const key of precedence) {
        // @ts-ignore dynamic index
        register(key, pronouns[key]);
    }

    if (lowerWordToMacro.size === 0) return text;

    const alternation = Array.from(lowerWordToMacro.keys()).map(escapeForRegex).join('|');
    if (!alternation) return text;
    const re = new RegExp(`\\b(${alternation})\\b`, 'gi');
    return text.replace(re, (m) => lowerWordToMacro.get(m.toLowerCase()) || m);
}

/**
 * Reads the current clipboard text safely. Returns null on failure.
 * @returns {Promise<string|null>}
 */
async function tryReadClipboardText() {
    try {
        if (navigator?.clipboard?.readText) {
            const txt = await navigator.clipboard.readText();
            return typeof txt === 'string' && txt.length > 0 ? txt : null;
        }
    } catch { /* ignore */ }
    return null;
}

/**
 * Copies the provided text to the clipboard.
 * @param {string} text
 * @returns {Promise<boolean>}
 */
async function copyToClipboard(text) {
    try {
        if (navigator?.clipboard?.writeText) {
            await navigator.clipboard.writeText(text);
            return true;
        }
    } catch { /* ignore */ }
    try {
        const ta = document.createElement('textarea');
        ta.value = text;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.focus();
        ta.select();
        const ok = document.execCommand('copy');
        ta.remove();
        return ok;
    } catch {
        return false;
    }
}

/**
 * Opens an input popup to paste text and replace pronouns with macros.
 * If clipboard contains text and no initial text is provided, the popup will prefill it automatically.
 * Default action converts and copies the result, then closes the popup.
 *
 * @param {string|null|undefined} initialText - Optional text to prefill
 */
export async function openPronounReplacePopup(initialText = null) {
    const showShorthandToggle = getPersonaShorthandSetting();

    const pronouns = getCurrentPronounValues();
    if (arePronounsEmpty(pronouns)) {
        toastr.warning(t`No persona pronouns are set. Set pronouns in Persona Management to enable the replacer.`);
        return;
    }

    /** @type {Popup?} */
    let popup = null;

    /**
     * @returns {HTMLInputElement}
     */
    function getReplaceShorthandsCheckbox() {
        const checkbox = popup?.dlg?.querySelector('#pronouns_replace_use_shorthands');
        return checkbox instanceof HTMLInputElement ? checkbox : null;
    }

    /**
     * @param {'subjective'|'objective'|'posDet'|'posPro'|'reflexive'} key
     * @param {string} label
     * @param {string} value
     * @param {string} macro
     * @param {boolean} useShorthands
     * @returns {string}
     */
    function buildRow(key, label, value, macro, useShorthands) {
        const alias = pickMatchingShorthandAlias(key, value);
        const finalMacro = alias && useShorthands ? `{{${alias}}}` : macro;
        return `<tr><td>${label}</td><td>${escapeHtml(value)}</td><td>→</td><td>${escapeHtml(finalMacro)}</td></tr>`;
    }

    /**
     * @returns {string}
     */
    function buildTable() {
        /** @type {Array<{key:'subjective'|'objective'|'posDet'|'posPro'|'reflexive', label:string}>} */
        const order = [
            { key: 'subjective', label: t`Subjective` },
            { key: 'objective', label: t`Objective` },
            { key: 'posDet', label: t`Possessive determiner` },
            { key: 'posPro', label: t`Possessive pronoun` },
            { key: 'reflexive', label: t`Reflexive` },
        ];
        const mapping = order.map(({ key, label }) => {
            const value = String(pronouns[key] ?? '').trim();
            if (!value) return null;
            const macroKey = key === 'posDet' ? 'pos_det' : key === 'posPro' ? 'pos_pro' : key;
            const baseMacro = `{{pronoun.${macroKey}}}`;
            return { key, label, value, macro: baseMacro };
        }).filter(Boolean);

        const useShorthands = !!getPersonaShorthandSetting() && (getReplaceShorthandsCheckbox()?.checked ?? true);
        return mapping.map(({ key, label, value, macro }) => buildRow(key, label, value, macro, useShorthands)).join('');
    }

    const content = `
        <h3>${t`Pronoun Replacer`}</h3>
        <p>${t`This tool converts direct pronoun words into macros for your current persona.`}</p>
        <p>${t`It supports shorthand macros if enabled.`}</p>
        <table class="pronoun-replacer-table">
            <thead>
                <tr><th>${t`Pronoun`}</th><th>${t`Value`}</th><th></th></th><th>${t`Macro`}</th></tr>
            </thead>
            <tbody>
                ${buildTable()}
            </tbody>
        </table>
    `;

    popup = new Popup(content, POPUP_TYPE.INPUT, String(initialText ?? ''), {
        okButton: t`Convert & Copy`,
        cancelButton: t`Close`,
        rows: 8,
        customInputs: showShorthandToggle ? [{
            id: 'pronouns_replace_use_shorthands',
            label: t`Use shorthand macros (e.g. {{she}}, {{him}})`,
            tooltip: t`If enabled, uses shorthand macro names where available. Falls back to full macros otherwise.`,
            defaultState: true,
        }] : null,
        customButtons: [
            {
                text: t`Paste`,
                classes: ['secondary'],
                action: async () => {
                    const pasted = await tryReadClipboardText();
                    if (pasted) popup.mainInput.value = pasted;
                },
            },
            {
                text: t`Convert`,
                classes: ['secondary'],
                action: async () => {
                    const checkbox = popup.dlg.querySelector('#pronouns_replace_use_shorthands');
                    const useSh = checkbox instanceof HTMLInputElement ? checkbox.checked : true;
                    const converted = replacePronounsWithMacros(String(popup.mainInput.value ?? ''), { useShorthands: useSh });
                    popup.mainInput.value = converted;
                    toastr.success(t`Converted`);
                },
            },
            {
                text: t`Copy`,
                classes: ['menu_button_primary'],
                action: async () => {
                    const ok = await copyToClipboard(popup.mainInput.value ?? '');
                    if (ok) toastr.success(t`Copied to clipboard`);
                },
            },
        ],
        onOpen: async (p) => {
            if (!p.mainInput.value) {
                const clip = await tryReadClipboardText();
                if (clip) p.mainInput.value = clip;
            }
        },
        onClosing: async (p) => {
            if (p.result >= POPUP_RESULT.AFFIRMATIVE) {
                const useSh = Boolean(p.inputResults?.get('pronouns_replace_use_shorthands') ?? true);
                const converted = replacePronounsWithMacros(String(p.value ?? ''), { useShorthands: useSh });
                const ok = await copyToClipboard(converted);
                if (ok) toastr.success(t`Converted and copied`);
                p.value = converted; // ensure the popup returns converted text value
                return true; // close on default action
            }
            return true; // allow close on cancel
        },
    });

    // Make a listener to rebuild the inline hint table when the checkbox is toggled
    const checkbox = getReplaceShorthandsCheckbox();
    checkbox.addEventListener('change', () => {
        // Replace the table of the popup content with a newly built table
        const table = popup.dlg.querySelector('.pronoun-replacer-table tbody');
        table.innerHTML = buildTable();
    });

    await popup.show();
}
