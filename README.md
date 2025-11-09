# SillyTavern Pronouns [Extension]

![ext version](https://img.shields.io/badge/dynamic/json?url=https%3A%2F%2Fraw.githubusercontent.com%2FWolfsblvt%2FSillyTavern-Pronouns%2Fmain%2Fmanifest.json&label=extension%20version&query=%24.version&color=blue)
![tag version](https://img.shields.io/github/v/tag/Wolfsblvt/SillyTavern-Pronouns?label=tag&color=lightblue)
![required](https://img.shields.io/badge/Required%20ST%20version-1.13.5-darkred)

> [!WARNING]
> This is a pre-release and under active development. APIs, macros, and UI may change. Breaking changes can occur until a first official release.

Persona pronoun management for SillyTavern. This extension adds a dedicated editor under Persona Management, quick presets (She/Her, He/Him, They/Them, It/Its) and prompt macros for the active persona (e.g., `{{pronoun.subjective}}`) with optional shorthand macros via settings.

Inspired by and partially ported from SillyTavern PR [#4542](https://github.com/SillyTavern/SillyTavern/pull/4542).

## Installation

Install using SillyTavern's extension installer from the URL:

```txt
https://github.com/Wolfsblvt/SillyTavern-Pronouns
```

## Features

- **Pronoun editor**
  - Appears under the persona description field in Persona Management.
  - Fields: subjective, objective, possessive determiner, possessive pronoun, reflexive.
  - Values are stored on the persona descriptor and persist with exports/backups.

- **Presets**
  - Quick-fill buttons: `She/Her`, `He/Him`, `They/Them`, `It/Its`.

- **Macros** (usable anywhere macros are supported)
  - Persona macros:
    - `{{pronoun.subjective}}`
    - `{{pronoun.objective}}`
    - `{{pronoun.pos_det}}`  (possessive determiner)
    - `{{pronoun.pos_pro}}`  (possessive pronoun)
    - `{{pronoun.reflexive}}`
  - Shorthand aliases (disabled by default — enable at Settings → Extensions → Pronouns → Enable shorthand macros):
    - Subjective: `{{she}}`, `{{he}}`, `{{they}}`
    - Objective: `{{her}}`, `{{him}}`, `{{them}}`
    - Possessive determiner: `{{her_}}`, `{{his_}}`, `{{their_}}` (note the underscore)
    - Possessive pronoun: `{{hers}}`, `{{his}}`, `{{theirs}}`
    - Reflexive: `{{herself}}`, `{{himself}}`, `{{themself}}`
  - The info icons next to each field show the currently available macros (including shorthands if enabled).

### Terminology
- **Subjective**: she/he/they/it (used as subject)
- **Objective**: her/him/them/it (used as object)
- **Possessive determiner**: her/his/their/its (before nouns)
- **Possessive pronoun**: hers/his/theirs/its (stands alone)
- **Reflexive**: herself/himself/themself/itself

For more information, see [pronouns.org](https://pronouns.org/) or [Wikipedia](https://en.wikipedia.org/wiki/English_personal_pronouns).

## Roadmap

- [x] Support WyvernChat macros as default
- [x] Add feature popup to paste text and replace pronouns with macros
- [x] Slash commands for pronoun management and direct text replacement
- [ ] (?) Optional setting to provide namespaced persona macros `{{pronoun.persona.*}}` in addition to the default `{{pronoun.*}}`
- [ ] Add support for character pronouns
- [ ] Shorthands in other languages.. maybe?
- [ ] add rainbows

## Contribution

- Discord: `@Wolfsblvt`
- Issues and pull requests are welcome.
