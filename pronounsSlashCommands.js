import { SlashCommand } from '../../../slash-commands/SlashCommand.js';
import { SlashCommandNamedArgument, ARGUMENT_TYPE, SlashCommandArgument } from '../../../slash-commands/SlashCommandArgument.js';
import { SlashCommandEnumValue, enumTypes } from '../../../slash-commands/SlashCommandEnumValue.js';
import { SlashCommandParser } from '../../../slash-commands/SlashCommandParser.js';
import { openPronounReplacePopup, replacePronounsWithMacros } from './replacer.js';
import { pronounPresets, getCurrentPronounValues, setCurrentPersonaPronounsPreset, setCurrentPersonaPronounValue, getPersonaShorthandSetting } from './index.js';
import { commonEnumProviders } from '../../../slash-commands/SlashCommandCommonEnumsProvider.js';
import { isTrueBoolean } from '../../../utils.js';

const pronounsEnums = {
    presets: () => Object.keys(pronounPresets).map(k => new SlashCommandEnumValue(k, `${pronounPresets[k].subjective}/${pronounPresets[k].objective}/...`, enumTypes.enum)),
    keys: [
        new SlashCommandEnumValue('subjective', 'Subjective pronoun', enumTypes.enum, 'S'),
        new SlashCommandEnumValue('objective', 'Objective pronoun', enumTypes.enum, 'O'),
        new SlashCommandEnumValue('posDet', 'Possessive determiner', enumTypes.enum, 'PD'),
        new SlashCommandEnumValue('posPro', 'Possessive pronoun', enumTypes.enum, 'PP'),
        new SlashCommandEnumValue('reflexive', 'Reflexive pronoun', enumTypes.enum, 'R'),
    ],
};

export function registerPronounsSlashCommands() {
    SlashCommandParser.addCommandObject(SlashCommand.fromProps({
        name: 'pronouns-open-replacer',
        returns: 'replaced text or empty string',
        namedArgumentList: [
            SlashCommandNamedArgument.fromProps({
                name: 'shorthands',
                description: 'Default state for "Use shorthand macros" checkbox',
                typeList: [ARGUMENT_TYPE.BOOLEAN],
                enumList: commonEnumProviders.boolean('trueFalse')(),
                forceEnum: true,
                defaultValue: getPersonaShorthandSetting() ? 'true' : 'false',
            }),
        ],
        unnamedArgumentList: [
            SlashCommandArgument.fromProps({
                description: 'Initial input text for the popup',
                typeList: [ARGUMENT_TYPE.STRING],
            }),
        ],
        callback: async (args, text = '') => {
            try {
                const useSh = typeof args.shorthands === 'string' ? isTrueBoolean(args.shorthands) : true;
                const result = await openPronounReplacePopup(String(text ?? ''), { defaultUseShorthands: useSh });
                return result || '';
            } catch (error) {
                toastr.error(String(error?.message ?? error), 'Pronouns');
                return '';
            }
        },
    }));

    SlashCommandParser.addCommandObject(SlashCommand.fromProps({
        name: 'pronouns-replace',
        returns: 'replaced text',
        namedArgumentList: [
            SlashCommandNamedArgument.fromProps({
                name: 'shorthands',
                description: 'Whether shorthand macros should be used if available',
                typeList: [ARGUMENT_TYPE.BOOLEAN],
                enumList: commonEnumProviders.boolean('trueFalse')(),
                forceEnum: true,
                defaultValue: getPersonaShorthandSetting() ? 'true' : 'false',
            }),
            SlashCommandNamedArgument.fromProps({
                name: 'preset',
                description: 'Pronoun preset to use',
                typeList: [ARGUMENT_TYPE.STRING],
                enumList: pronounsEnums.presets(),
                forceEnum: true,
            }),
            SlashCommandNamedArgument.fromProps({ name: 'subjective', description: 'Subjective pronoun', typeList: [ARGUMENT_TYPE.STRING] }),
            SlashCommandNamedArgument.fromProps({ name: 'objective', description: 'Objective pronoun', typeList: [ARGUMENT_TYPE.STRING] }),
            SlashCommandNamedArgument.fromProps({ name: 'posDet', description: 'Possessive determiner', typeList: [ARGUMENT_TYPE.STRING] }),
            SlashCommandNamedArgument.fromProps({ name: 'posPro', description: 'Possessive pronoun', typeList: [ARGUMENT_TYPE.STRING] }),
            SlashCommandNamedArgument.fromProps({ name: 'reflexive', description: 'Reflexive pronoun', typeList: [ARGUMENT_TYPE.STRING] }),
        ],
        unnamedArgumentList: [
            SlashCommandArgument.fromProps({
                description: 'Input text to convert',
                typeList: [ARGUMENT_TYPE.STRING],
            }),
        ],
        callback: (args, text = '') => {
            try {
                const useSh = typeof args.shorthands === 'string' ? isTrueBoolean(args.shorthands) : true;
                const presetKey = typeof args.preset === 'string' ? args.preset : null;
                let pronouns = null;
                if (presetKey && pronounPresets[presetKey]) pronouns = { ...pronounPresets[presetKey] };
                pronouns = pronouns ?? { ...getCurrentPronounValues() };
                const keys = ['subjective', 'objective', 'posDet', 'posPro', 'reflexive'];
                for (const k of keys) {
                    if (typeof args[k] === 'string') pronouns[k] = args[k];
                }
                const result = replacePronounsWithMacros(String(text ?? ''), { useShorthands: useSh, pronouns });
                return result || '';
            } catch (error) {
                toastr.error(String(error?.message ?? error), 'Pronouns');
                return '';
            }
        },
    }));

    SlashCommandParser.addCommandObject(SlashCommand.fromProps({
        name: 'pronouns-set-preset',
        returns: 'applied preset key',
        unnamedArgumentList: [
            SlashCommandArgument.fromProps({
                description: 'Pronoun preset key',
                typeList: [ARGUMENT_TYPE.STRING],
                enumList: pronounsEnums.presets(),
                forceEnum: true,
                isRequired: true,
            }),
        ],
        callback: (_, presetName) => {
            try {
                const key = String(presetName ?? '').trim();
                if (!key || !pronounPresets[key]) return '';
                setCurrentPersonaPronounsPreset(key);
                return key;
            } catch (error) {
                toastr.error(String(error?.message ?? error), 'Pronouns');
                return '';
            }
        },
    }));

    SlashCommandParser.addCommandObject(SlashCommand.fromProps({
        name: 'pronouns-set',
        returns: 'updated pronoun value',
        namedArgumentList: [
            SlashCommandNamedArgument.fromProps({
                name: 'key',
                description: 'Pronoun key to set',
                typeList: [ARGUMENT_TYPE.STRING],
                enumList: pronounsEnums.keys,
                forceEnum: true,
            }),
        ],
        unnamedArgumentList: [
            SlashCommandArgument.fromProps({
                description: 'Pronoun value',
                typeList: [ARGUMENT_TYPE.STRING],
            }),
        ],
        callback: (args, value) => {
            try {
                const key = String(args.key ?? '').trim();
                const val = String(value ?? '');
                if (!key) return '';
                return setCurrentPersonaPronounValue(key, val) ?? '';
            } catch (error) {
                toastr.error(String(error?.message ?? error), 'Pronouns');
                return '';
            }
        },
    }));
}
