# SillyTavern Pronouns Extension

Add persona pronoun management to SillyTavern without touching core. The extension ports the functionality that previously lived in the SillyTavern staging branch pull request [#4542](https://github.com/SillyTavern/SillyTavern/pull/4542), providing a dedicated UI for editing pronouns and new prompt macros that resolve to the active persona's values.

## Features

- Adds a pronoun editor to the Persona Management screen with fields for subjective, objective, possessive determiner, possessive pronoun, and reflexive forms.
- Includes quick-fill presets for common pronoun sets (She/Her, He/Him, They/Them, It/Its).
- Stores pronoun data directly on persona descriptors so the values persist with exports/imports and backups.
- Registers the following macros for use anywhere macros are supported:
  - `{{pronoun.subjective}}`
  - `{{pronoun.objective}}`
  - `{{pronoun.pos_det}}`
  - `{{pronoun.pos_pro}}`
  - `{{pronoun.reflexive}}`

## Installation

1. Download or clone this repository.
2. Copy the `scripts/extensions/third-party/sillytavern-pronouns` folder into your SillyTavern installation at `public/scripts/extensions/third-party/` (create the directory if it does not exist).
3. In SillyTavern, open **Settings → Extensions**, enable **Persona Pronouns**, and reload if prompted.

The pronoun editor will appear underneath the persona description field once the extension is enabled.

## Support and Contributions

- Discord: `@Wolfsblvt`
- GitHub Issues and pull requests are welcome.

## License

AGPL-3.0
