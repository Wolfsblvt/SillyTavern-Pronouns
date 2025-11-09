import { eventSource, event_types, saveSettingsDebounced, user_avatar } from '../../../../script.js';
import { power_user } from '../../../../scripts/power-user.js';
import { MacrosParser } from '../../../../scripts/macros.js';
import { t } from '../../../../scripts/i18n.js';
import { extension_settings, renderExtensionTemplateAsync } from '../../../extensions.js';
import { openPronounReplacePopup } from './replacer.js';

const extensionName = 'sillytavern-pronouns';
const extensionFolderName = 'SillyTavern-Pronouns';

/**
 * @typedef {Object} Pronouns
 * @property {string} subjective - Subjective pronoun
 * @property {string} objective - Objective pronoun
 * @property {string} posDet - Possessive determiner
 * @property {string} posPro - Possessive pronoun
 * @property {string} reflexive - Reflexive pronoun
 */

/**
 * @typedef {Object} PronounMacroManager
 * @property {Object} shorthands - Shorthand macros
 * @property {() => void} shorthands.toggle - Toggles shorthands on and off
 * @property {(enabled: boolean) => void} shorthands.set - Sets shorthands on or off
 * @property {() => void} shorthands.enable - Enables shorthands
 * @property {() => void} shorthands.disable - Disables shorthands
 * @property {() => string[]} getRegistered - Returns a set of all registered macros
 * @property {() => { subjective: string[]; objective: string[]; posDet: string[]; posPro: string[]; reflexive: string[] }} getRegisteredByType - Returns a shallow mapping of pronoun type -> set of macro names
 */

const settingKeys = Object.freeze({
    ENABLE_PERSONA_SHORTHANDS: 'enablePersonaShorthands',
});

const defaultExtensionSettings = Object.freeze({
    [settingKeys.ENABLE_PERSONA_SHORTHANDS]: false, // shorthands should be opt-in by design, they bloat the macros list
});

/** @type {Pronouns} */
const defaultPronoun = Object.freeze({
    subjective: '',
    objective: '',
    posDet: '',
    posPro: '',
    reflexive: '',
});

/** @type {{[presetName: string]: Pronouns}} */
const pronounPresets = {
    she: { subjective: 'she', objective: 'her', posDet: 'her', posPro: 'hers', reflexive: 'herself' },
    he: { subjective: 'he', objective: 'him', posDet: 'his', posPro: 'his', reflexive: 'himself' },
    they: { subjective: 'they', objective: 'them', posDet: 'their', posPro: 'theirs', reflexive: 'themselves' },
    it: { subjective: 'it', objective: 'it', posDet: 'its', posPro: 'its', reflexive: 'itself' },
};

/** @type {Map<string, ReturnType<typeof createPronounMacroManager>>} */
const pronounMacroManagers = new Map();

/** @typedef {{ names: string[]; pronounKey: 'subjective' | 'objective' | 'posDet' | 'posPro' | 'reflexive'; }} PronounShorthandAlias */
/** @type {ReadonlyArray<PronounShorthandAlias>} */
export const defaultShorthandAliases = Object.freeze([
    { pronounKey: 'subjective', names: ['she', 'he', 'they'] },
    { pronounKey: 'objective', names: ['her', 'him', 'them'] },
    { pronounKey: 'posDet', names: ['her_', 'his_', 'their_'] },
    { pronounKey: 'posPro', names: ['hers', 'his', 'theirs'] },
    { pronounKey: 'reflexive', names: ['herself', 'himself', 'themself'] },
]);

// Local settings and state tracking
let isUpdating = false;
let lastPersonaId = null;
let uiInjected = false;

/**
 * Gets the current persona ID
 * @returns {string} The current persona ID
 */
function getCurrentPersonaId() {
    return user_avatar || '';
}

/**
 * Ensures the persona container exists
 * @returns {{pronoun: Pronouns} | null} The persona container
 */
function ensurePersonaContainer() {
    power_user.persona_descriptions = power_user.persona_descriptions || {};
    const personaId = getCurrentPersonaId();
    if (!personaId) {
        return null;
    }

    if (!power_user.persona_descriptions[personaId]) {
        power_user.persona_descriptions[personaId] = {};
    }

    const descriptor = power_user.persona_descriptions[personaId];
    if (!descriptor.pronoun) {
        descriptor.pronoun = { ...defaultPronoun };
    } else {
        descriptor.pronoun = {
            subjective: descriptor.pronoun.subjective ?? '',
            objective: descriptor.pronoun.objective ?? '',
            posDet: descriptor.pronoun.posDet ?? '',
            posPro: descriptor.pronoun.posPro ?? '',
            reflexive: descriptor.pronoun.reflexive ?? '',
        };
    }

    return descriptor;
}

/**
 * Gets the current pronoun values
 * @returns {Pronouns} The current pronoun values
 */
export function getCurrentPronounValues() {
    const personaId = getCurrentPersonaId();
    if (!personaId) {
        return defaultPronoun;
    }

    const descriptor = power_user.persona_descriptions?.[personaId];
    const pronoun = descriptor?.pronoun;
    return {
        subjective: pronoun?.subjective ?? '',
        objective: pronoun?.objective ?? '',
        posDet: pronoun?.posDet ?? '',
        posPro: pronoun?.posPro ?? '',
        reflexive: pronoun?.reflexive ?? '',
    };
}

function refreshPronounInputs() {
    if (!uiInjected) {
        return;
    }

    const personaId = getCurrentPersonaId();
    if (lastPersonaId !== personaId) {
        lastPersonaId = personaId;
    }

    const pronouns = getCurrentPronounValues();

    isUpdating = true;
    $('#persona_pronoun_subjective').val(pronouns.subjective);
    $('#persona_pronoun_objective').val(pronouns.objective);
    $('#persona_pronoun_pos_det').val(pronouns.posDet);
    $('#persona_pronoun_pos_pro').val(pronouns.posPro);
    $('#persona_pronoun_reflexive').val(pronouns.reflexive);
    isUpdating = false;
}

function onPronounInput() {
    if (isUpdating) {
        return;
    }

    const descriptor = ensurePersonaContainer();
    if (!descriptor) {
        return;
    }

    descriptor.pronoun.subjective = String($('#persona_pronoun_subjective').val() ?? '');
    descriptor.pronoun.objective = String($('#persona_pronoun_objective').val() ?? '');
    descriptor.pronoun.posDet = String($('#persona_pronoun_pos_det').val() ?? '');
    descriptor.pronoun.posPro = String($('#persona_pronoun_pos_pro').val() ?? '');
    descriptor.pronoun.reflexive = String($('#persona_pronoun_reflexive').val() ?? '');

    saveSettingsDebounced();
}

function onPronounPresetClick(event) {
    const presetKey = $(event.currentTarget).data('preset');
    const preset = pronounPresets[presetKey];
    if (!preset) {
        return;
    }

    isUpdating = true;
    $('#persona_pronoun_subjective').val(preset.subjective);
    $('#persona_pronoun_objective').val(preset.objective);
    $('#persona_pronoun_pos_det').val(preset.posDet);
    $('#persona_pronoun_pos_pro').val(preset.posPro);
    $('#persona_pronoun_reflexive').val(preset.reflexive);
    isUpdating = false;

    onPronounInput();
}

function ensureExtensionSettings() {
    extension_settings[extensionName] = extension_settings[extensionName] || {};

    const settings = extension_settings[extensionName];
    for (const [key, value] of Object.entries(defaultExtensionSettings)) {
        if (!(key in settings)) {
            settings[key] = value;
        }
    }

    return settings;
}

export function getPersonaShorthandSetting() {
    return Boolean(extension_settings[extensionName]?.[settingKeys.ENABLE_PERSONA_SHORTHANDS]);
}

function setPersonaShorthandSetting(enabled) {
    const settings = ensureExtensionSettings();
    settings[settingKeys.ENABLE_PERSONA_SHORTHANDS] = enabled;
    applyPersonaShorthandSetting(enabled);
    saveSettingsDebounced();
}

function applyPersonaShorthandSetting(enabled) {
    const manager = pronounMacroManagers.get('persona');
    manager?.shorthands.set(enabled);
    $('#pronouns_enable_shorthands').prop('checked', enabled);
    updatePronounTooltips();
}

function onShorthandToggleChange(event) {
    const enabled = $(event.currentTarget).is(':checked');
    setPersonaShorthandSetting(enabled);
}

/**
 * @param {{ target?: string, getValues?: () => { subjective: string, objective: string, posDet: string, posPro: string, reflexive: string }, shorthandAliases?: ReadonlyArray<{ names: string[], pronounKey: string }> }} options
 * @returns {PronounMacroManager}
 */
function createPronounMacroManager({ target = 'persona', getValues = getCurrentPronounValues, shorthandAliases = defaultShorthandAliases } = {}) {
    const descriptions = {
        subjective: t`Current ${target} subjective pronoun (she/he/they)`,
        objective: t`Current ${target} objective pronoun (her/him/them)`,
        pos_det: t`Current ${target} possessive determiner (her/his/their)`,
        pos_pro: t`Current ${target} possessive pronoun (hers/his/theirs)`,
        reflexive: t`Current ${target} reflexive pronoun (herself/himself/themself)`,
    };

    const valueGetters = {
        subjective: () => getValues().subjective,
        objective: () => getValues().objective,
        posDet: () => getValues().posDet,
        posPro: () => getValues().posPro,
        reflexive: () => getValues().reflexive,
    };

    /** @type {Map<'subjective' | 'objective' | 'posDet' | 'posPro' | 'reflexive' | string, Set<string>>} */
    const macroByType = new Map([
        ['subjective', new Set()],
        ['objective', new Set()],
        ['posDet', new Set()],
        ['posPro', new Set()],
        ['reflexive', new Set()],
    ]);
    /** @type {Set<string>} */
    const shorthands = new Set();

    // Persona macros will have - as their base macro - no sub name of them (similarly to how WyvernChat has them)
    const subName = target === 'persona' ? '' : `${target}.`;

    const baseMacroDefinitions = [
        { name: `pronoun.${subName}subjective`, getter: valueGetters.subjective, description: descriptions.subjective, pronounKey: 'subjective' },
        { name: `pronoun.${subName}objective`, getter: valueGetters.objective, description: descriptions.objective, pronounKey: 'objective' },
        { name: `pronoun.${subName}pos_det`, getter: valueGetters.posDet, description: descriptions.pos_det, pronounKey: 'posDet' },
        { name: `pronoun.${subName}pos_pro`, getter: valueGetters.posPro, description: descriptions.pos_pro, pronounKey: 'posPro' },
        { name: `pronoun.${subName}reflexive`, getter: valueGetters.reflexive, description: descriptions.reflexive, pronounKey: 'reflexive' },
    ];
    baseMacroDefinitions.forEach(({ name, getter, description, pronounKey }) => {
        if (MacrosParser.has(name)) return;
        MacrosParser.registerMacro(name, getter, description);
        macroByType.get(pronounKey).add(name);
    });

    function enableShorthands() {
        shorthandAliases.forEach(({ names, pronounKey }) => {
            const getter = valueGetters[pronounKey];
            const descriptionKey = pronounKey === 'posDet' ? 'pos_det' : pronounKey === 'posPro' ? 'pos_pro' : pronounKey;
            const description = descriptions[descriptionKey];
            if (!getter || !description) return;
            names.forEach(name => {
                if (MacrosParser.has(name)) return;
                MacrosParser.registerMacro(name, getter, description);
                macroByType.get(pronounKey).add(name);
                shorthands.add(name);
            });
        });
    }

    function disableShorthands() {
        // Unregister and clear based on shortHands
        for (const name of shorthands) {
            for (const [, macros] of macroByType.entries()) {
                if (!macros.has(name)) continue;
                MacrosParser.unregisterMacro(name);
                macros.delete(name);
                shorthands.delete(name);
            }
        }
        shorthands.clear();
    }

    if (target === 'persona') {
        updatePronounTooltips();
    }

    return {
        shorthands: {
            toggle: () => Array.from(macroByType.values()).some(s => s.size > 0) ? disableShorthands() : enableShorthands(),
            set: (enabled) => enabled ? enableShorthands() : disableShorthands(),
            enable: enableShorthands,
            disable: disableShorthands,
        },
        getRegistered: () => Array.from(macroByType.values()).flatMap(set => Array.from(set)),
        getRegisteredByType: () => ({
            subjective: Array.from(macroByType.get('subjective') ?? []),
            objective: Array.from(macroByType.get('objective') ?? []),
            posDet: Array.from(macroByType.get('posDet') ?? []),
            posPro: Array.from(macroByType.get('posPro') ?? []),
            reflexive: Array.from(macroByType.get('reflexive') ?? []),
        }),
    };
}

/**
 * Updates the info icon titles with the currently available macros per pronoun type
 * @param {string} target - The target to receive the macro updates. Defaults to 'persona'
 */
function updatePronounTooltips(target = 'persona') {
    const manager = pronounMacroManagers.get(target);
    if (!manager) return;

    const byType = manager.getRegisteredByType?.();
    if (!byType) return;

    /** @param {string} id */
    /** @param {string} typeName */
    function setTitle(id, typeName, macros) {
        const infoEl = $(`#${id}`).parent().find('.fa-solid.fa-circle-info');
        if (!infoEl || infoEl.length === 0) return;
        const macroList = Array.from(macros).map(name => `  {{${name}}}`).join('\n');
        // Keep a concise, consistent message
        const capitalizedTypeName = typeName.charAt(0).toUpperCase() + typeName.slice(1);
        infoEl.attr('title', t`${capitalizedTypeName} pronoun macros` + '\n' + macroList);
    }

    setTitle('persona_pronoun_subjective', 'subjective', byType.subjective ?? new Set());
    setTitle('persona_pronoun_objective', 'objective', byType.objective ?? new Set());
    setTitle('persona_pronoun_pos_det', 'possessive determiner', byType.posDet ?? new Set());
    setTitle('persona_pronoun_pos_pro', 'possessive pronoun', byType.posPro ?? new Set());
    setTitle('persona_pronoun_reflexive', 'reflexive pronoun', byType.reflexive ?? new Set());
}

async function injectPersonaPronounUI() {
    if (uiInjected || document.getElementById('persona_pronoun_extension')) {
        return;
    }

    const target = $('#persona_description');

    const html = await renderExtensionTemplateAsync(`third-party/${extensionFolderName}`, 'persona-pronouns');
    target.after(html);
}

async function injectExtensionSettingsUI() {
    if (uiInjected || document.getElementById('extension_settings_pronouns')) {
        return;
    }

    // Check if settings2 or settings has more children than the other, so we insert in the one with less
    const col2 = document.getElementById('extensions_settings2');
    const col1 = document.getElementById('extensions_settings');
    const parent = col2 && col1 ? (col2.children.length > col1.children.length ? col1 : col2) : (col2 || col1);

    const html = await renderExtensionTemplateAsync(`third-party/${extensionFolderName}`, 'settings');
    const template = document.createElement('template');
    template.innerHTML = html;
    parent.appendChild(template.content);

    const shorthandsToggle = $('#pronouns_enable_shorthands');
    shorthandsToggle.prop('checked', getPersonaShorthandSetting());
    shorthandsToggle.on('change', onShorthandToggleChange);
}

async function injectPronounUI() {
    if (uiInjected) return;
    await injectPersonaPronounUI();
    await injectExtensionSettingsUI();
    uiInjected = true;
}

function registerEventListeners() {
    $(document).on('click', '#persona_pronoun_extension [data-preset]', onPronounPresetClick);
    $(document).on('input', '#persona_pronoun_extension input', onPronounInput);

    $(document).on('click', '#user_avatar_block .avatar-container', () => {
        setTimeout(refreshPronounInputs, 0);
    });
    eventSource.on(event_types.CHAT_CHANGED, () => setTimeout(refreshPronounInputs, 0));

    // Settings button to open the replacer popup
    $(document).on('click', '#pronouns_open_replacer', () => openPronounReplacePopup());
}

/**
 * This function is called when the extension is loaded
 */
jQuery(async () => {
    ensureExtensionSettings();

    await injectPronounUI();
    registerEventListeners();

    const personaManager = createPronounMacroManager({
        target: 'persona',
        getValues: getCurrentPronounValues,
    });
    pronounMacroManagers.set('persona', personaManager);

    applyPersonaShorthandSetting(getPersonaShorthandSetting());
    refreshPronounInputs();
});
