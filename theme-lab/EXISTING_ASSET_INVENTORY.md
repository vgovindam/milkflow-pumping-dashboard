# Existing Asset Reuse Inventory

This inventory prevents the next implementation from recreating assets that already exist.

## Theme/world scenes currently present

- `assets/themes/jungle-canopy.svg`
- `assets/themes/safari-adventure.svg`
- `assets/themes/safari-world.svg`
- `assets/themes/safari-world-v2.svg`
- `assets/themes/butterfly-garden.svg`
- `assets/themes/unicorn-dreams.svg`
- `assets/themes/cloud-island.svg`
- `assets/themes/forest-clearing.svg`
- `assets/themes/princess-palace.svg`

## Detail art currently present

- `assets/theme-details/safari.svg`
- `assets/theme-details/butterfly.svg`
- `assets/theme-details/unicorn.svg`
- `assets/theme-details/princess.svg`

## Animal assets currently present

- bear
- beaver
- elephant
- fox
- hippo
- monkey
- owl
- parrot
- rabbit
- tiger

Location: `assets/animals/`

## Current production theme architecture

Current production uses:

- `experience-theme.js`
- `experience-system.css`
- `experience-components.css`
- `theme.css`
- `assets/themes-v2/`
- `assets/theme-icons/`
- `assets/care-icons/`

Do not edit these from this future branch merely to make the new catalog visible. Integration belongs to a later controlled iteration after the active Claude work is audited.

## Review rule

For every future asset, classify an existing candidate as one of:

1. **reuse as-is**
2. **reuse after optimization/recomposition**
3. **reference only / replace with higher-quality art**
4. **retire after migration**

Never delete or overwrite an existing source asset during exploration.
