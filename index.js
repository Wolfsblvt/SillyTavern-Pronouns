import { eventSource, event_types, saveSettingsDebounced, user_avatar } from '../../../../script.js';
import { power_user } from '../../../../scripts/power-user.js';
import { MacrosParser } from '../../../../scripts/macros.js';
import { t } from '../../../../scripts/i18n.js';

const extensionName = 'sillytavern-pronouns';
const extensionFolderPath = `scripts/extensions/third-party/${extensionName}`;

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

function registerEventListeners() {
    $(document).on('click', '#persona_pronoun_extension [data-preset]', onPronounPresetClick);
    $(document).on('input', '#persona_pronoun_extension input', onPronounInput);

    $(document).on('click', '#user_avatar_block .avatar-container', () => {
        setTimeout(refreshPronounInputs, 0);
    });

    eventSource.on(event_types.SETTINGS_LOADED_AFTER, () => setTimeout(refreshPronounInputs, 0));
    eventSource.on(event_types.CHAT_CHANGED, () => setTimeout(refreshPronounInputs, 0));
    eventSource.on(event_types.SETTINGS_UPDATED, () => setTimeout(refreshPronounInputs, 0));
}

function registerPronounMacros() {
    const descriptions = {
        subjective: t`Current persona subjective pronoun`,
        objective: t`Current persona objective pronoun`,
        pos_det: t`Current persona possessive determiner`,
        pos_pro: t`Current persona possessive pronoun`,
        reflexive: t`Current persona reflexive pronoun`,
    };

    MacrosParser.registerMacro('pronoun.subjective', () => getCurrentPronounValues().subjective, descriptions.subjective);
    MacrosParser.registerMacro('pronoun.objective', () => getCurrentPronounValues().objective, descriptions.objective);
    MacrosParser.registerMacro('pronoun.pos_det', () => getCurrentPronounValues().posDet, descriptions.pos_det);
    MacrosParser.registerMacro('pronoun.pos_pro', () => getCurrentPronounValues().posPro, descriptions.pos_pro);
    MacrosParser.registerMacro('pronoun.reflexive', () => getCurrentPronounValues().reflexive, descriptions.reflexive);
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
    const container = $('#persona_pronoun_extension');
    container.find('.persona_pronoun_title').text(t`Pronoun Settings`);
    const labelTexts = {
        subjective: t`Subjective ({{pronoun.subjective}}):`,
        objective: t`Objective ({{pronoun.objective}}):`,
        pos_det: t`Possessive Determiner ({{pronoun.pos_det}}):`,
        pos_pro: t`Possessive Pronoun ({{pronoun.pos_pro}}):`,
        reflexive: t`Reflexive ({{pronoun.reflexive}}):`,
    };
    for (const [key, text] of Object.entries(labelTexts)) {
        container.find(`[data-pronoun-label="${key}"]`).text(text);
    }

    const presetTexts = {
        she: t`She/Her`,
        he: t`He/Him`,
        they: t`They/Them`,
        it: t`It/Its`,
    };
    for (const [key, text] of Object.entries(presetTexts)) {
        const button = container.find(`[data-preset="${key}"]`);
        button.attr('title', t`Set pronouns to ${text}`);
        container.find(`[data-preset-label="${key}"]`).text(text);
    }
    uiInjected = true;
}

// This function is called when the extension is loaded
jQuery(async () => {
    await injectPronounUI();
    registerEventListeners();
    registerPronounMacros();
    refreshPronounInputs();
});
