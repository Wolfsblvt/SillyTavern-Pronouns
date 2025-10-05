import { eventSource, event_types, saveSettingsDebounced, user_avatar } from '../../../../script.js';
import { power_user } from '../../../../scripts/power-user.js';
import { MacrosParser } from '../../../../scripts/macros.js';
import { t } from '../../../../scripts/i18n.js';

const extensionName = 'sillytavern-pronouns';
const extensionFolderPath = `scripts/extensions/third-party/${extensionName}`;

const SettingKeys = Object.freeze({
    ENABLE_PERSONA_SHORTHANDS: 'enablePersonaPronounShorthands',
});

const defaultExtensionSettings = Object.freeze({
    [SettingKeys.ENABLE_PERSONA_SHORTHANDS]: true,
});

/**
 * @typedef {Object} Pronouns
 * @property {string} subjective - Subjective pronoun
 * @property {string} objective - Objective pronoun
 * @property {string} posDet - Possessive determiner
 * @property {string} posPro - Possessive pronoun
 * @property {string} reflexive - Reflexive pronoun
 */

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

let isUpdating = false;
let lastPersonaId = null;
let uiInjected = false;
let settingsPanelInjected = false;

/** @type {Map<string, ReturnType<typeof createPronounMacroManager>>} */
const pronounMacroManagers = new Map();

/** @typedef {{ names: string[]; pronounKey: 'subjective' | 'objective' | 'posDet' | 'posPro' | 'reflexive'; }} PronounShorthandAlias */

/** @type {ReadonlyArray<PronounShorthandAlias>} */
const defaultShorthandAliases = Object.freeze([
    { pronounKey: 'subjective', names: ['she', 'he', 'they'] },
    { pronounKey: 'objective', names: ['her', 'him', 'them'] },
    { pronounKey: 'posDet', names: ['her_', 'his_', 'their_'] },
    { pronounKey: 'posPro', names: ['hers', 'his', 'theirs'] },
    { pronounKey: 'reflexive', names: ['herself', 'himself', 'themself'] },
]);

function ensureExtensionSettings() {
    window.extension_settings = window.extension_settings || {};
    window.extension_settings[extensionName] = window.extension_settings[extensionName] || {};

    const settings = window.extension_settings[extensionName];
    for (const [key, value] of Object.entries(defaultExtensionSettings)) {
        if (!(key in settings)) {
            settings[key] = value;
        }
    }

    return settings;
}

function getPersonaShorthandSetting() {
    const settings = ensureExtensionSettings();
    return Boolean(settings[SettingKeys.ENABLE_PERSONA_SHORTHANDS]);
}

function setPersonaShorthandSetting(enabled) {
    const settings = ensureExtensionSettings();
    settings[SettingKeys.ENABLE_PERSONA_SHORTHANDS] = enabled;
    applyPersonaShorthandSetting(enabled);
    saveSettingsDebounced();
}

function applyPersonaShorthandSetting(enabled) {
    const manager = pronounMacroManagers.get('persona');
    if (manager) {
        manager.setShorthandsEnabled(enabled);
    }

    updateShorthandToggleUI(enabled);
}

function updateShorthandToggleUI(enabled) {
    $('#persona_pronoun_enable_shorthands').prop('checked', enabled);
}

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
function getCurrentPronounValues() {
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

function onShorthandToggleChange(event) {
    const enabled = $(event.currentTarget).is(':checked');
    setPersonaShorthandSetting(enabled);
}

function registerEventListeners() {
    $(document).on('click', '#persona_pronoun_extension [data-preset]', onPronounPresetClick);
    $(document).on('input', '#persona_pronoun_extension input', onPronounInput);
    $(document).on('change', '#persona_pronoun_enable_shorthands', onShorthandToggleChange);

    $(document).on('click', '#user_avatar_block .avatar-container', () => {
        setTimeout(refreshPronounInputs, 0);
    });

    eventSource.on(event_types.SETTINGS_LOADED_AFTER, () => {
        setTimeout(() => {
            refreshPronounInputs();
            applyPersonaShorthandSetting(getPersonaShorthandSetting());
        }, 0);
    });
    eventSource.on(event_types.CHAT_CHANGED, () => setTimeout(refreshPronounInputs, 0));
    eventSource.on(event_types.SETTINGS_UPDATED, () => {
        setTimeout(() => {
            refreshPronounInputs();
            applyPersonaShorthandSetting(getPersonaShorthandSetting());
        }, 0);
    });
}

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

    /** @type {{[K in keyof Pronouns]: string}} */
    const descriptionMap = {
        subjective: descriptions.subjective,
        objective: descriptions.objective,
        posDet: descriptions.pos_det,
        posPro: descriptions.pos_pro,
        reflexive: descriptions.reflexive,
    };

    let baseRegistered = false;
    let shorthandsEnabled = false;
    const shorthandMacroNames = new Set();

    const baseMacroDefinitions = [
        { name: `pronoun.${target}.subjective`, getter: valueGetters.subjective, description: descriptions.subjective },
        { name: `pronoun.${target}.objective`, getter: valueGetters.objective, description: descriptions.objective },
        { name: `pronoun.${target}.pos_det`, getter: valueGetters.posDet, description: descriptions.pos_det },
        { name: `pronoun.${target}.pos_pro`, getter: valueGetters.posPro, description: descriptions.pos_pro },
        { name: `pronoun.${target}.reflexive`, getter: valueGetters.reflexive, description: descriptions.reflexive },
    ];

    function registerBaseMacros() {
        if (baseRegistered) {
            return;
        }

        baseMacroDefinitions.forEach(({ name, getter, description }) => {
            MacrosParser.registerMacro(name, getter, description);
        });

        baseRegistered = true;
    }

    function enableShorthands() {
        if (shorthandsEnabled) {
            return;
        }

        shorthandAliases.forEach(({ names, pronounKey }) => {
            const getter = valueGetters[pronounKey];
            const description = descriptionMap[pronounKey];
            if (!getter || !description) {
                return;
            }

            names.forEach(name => {
                MacrosParser.registerMacro(name, getter, description);
                shorthandMacroNames.add(name);
            });
        });

        shorthandsEnabled = true;
    }

    function disableShorthands() {
        if (!shorthandsEnabled) {
            return;
        }

        shorthandMacroNames.forEach(name => {
            MacrosParser.unregisterMacro(name);
        });

        shorthandMacroNames.clear();
        shorthandsEnabled = false;
    }

    registerBaseMacros();

    return {
        registerBase: registerBaseMacros,
        enableShorthands,
        disableShorthands,
        setShorthandsEnabled(enabled) {
            registerBaseMacros();
            if (enabled) {
                enableShorthands();
            } else {
                disableShorthands();
            }
        },
    };
}

async function injectPronounUI() {
    if (uiInjected || document.getElementById('persona_pronoun_extension')) {
        uiInjected = true;
        return;
    }

    const target = $('#persona_description');
    if (!target.length) {
        return;
    }

    const html = await $.get(`${extensionFolderPath}/persona-pronouns.html`);
    target.after(html);

    // const container = $('#persona_pronoun_extension');

    uiInjected = true;
}

function injectExtensionSettingsUI() {
    if (settingsPanelInjected) {
        return;
    }

    const parent = document.getElementById('extensions_settings2') || document.getElementById('extensions_settings');
    if (!parent) {
        return;
    }

    const container = $('<div />', {
        id: `${extensionName}_settings_container`,
        class: 'extension_container',
    });

    const header = $('<h4 />', {
        text: t`Persona Pronoun Macros`,
    }).attr('data-i18n', 'Persona Pronoun Macros');

    const toggleLabel = $('<label />', {
        class: 'checkbox_label flex-container alignitemscenter',
    });

    const toggleInput = $('<input />', {
        type: 'checkbox',
        id: 'persona_pronoun_enable_shorthands',
    });

    const toggleText = $('<span />', {
        text: t`Enable shorthand macros for persona pronouns`,
    }).attr('data-i18n', 'Enable shorthand macros for persona pronouns');

    toggleLabel.append(toggleInput, toggleText);
    container.append(header, toggleLabel);
    parent.appendChild(container.get(0));

    settingsPanelInjected = true;

    updateShorthandToggleUI(getPersonaShorthandSetting());
}

// This function is called when the extension is loaded
jQuery(async () => {
    ensureExtensionSettings();

    await injectPronounUI();
    injectExtensionSettingsUI();
    registerEventListeners();
    const personaManager = createPronounMacroManager({
        target: 'persona',
        getValues: getCurrentPronounValues,
    });
    pronounMacroManagers.set('persona', personaManager);
    applyPersonaShorthandSetting(getPersonaShorthandSetting());
    refreshPronounInputs();
});
