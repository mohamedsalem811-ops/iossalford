# SALFORD POS — approved design

Approved by the owner: **Mix B + C with the centred logo**.
Design canvas: https://claude.ai/artifact/F1zmbBL5uSniB6Vu7ujmUQ (artboard "Mix · B + C").

## Principles

- **Structure from iOS 26 (C):** large titles on inner screens, segmented controls, grouped
  inset lists with tinted icon squares and chevrons, native sheets, menus and pickers,
  Liquid Glass tab bar.
- **Warmth from Boutique (B):** one coloured hero card per screen for the most important number,
  soft rounded cards (24–28 px corners) with light shadows in light mode, flat in dark mode.
- **Centred logo (A):** the home screen of each system shows the redrawn logo centred at the top,
  with the greeting, date and dollar rate on one row under it.
- **Light and dark mode** for everything; dark mode uses true black backgrounds.
- **Arabic, right-to-left, digits 0-9 only.**

## Logos

Redrawn as lettering, not photos, so they work on any background:

- **Jewelry:** SJ monogram (high-contrast serif, Playfair Display), "SALFORD" with a small star
  on its left and a larger star above its right end, "jewelry" under it.
- **Scarves:** SS monogram (Cormorant Garamond, second S lighter) with a small star on each side,
  a line — star — line divider, "SALFORD" widely spaced, "scarfs" in italic.
- Ink follows the text colour of the mode; "jewelry", "scarfs" and the divider use the accent.
- Mark-only version (monogram alone) for the app icon and small badges.

## Colour tokens

| Token           | Jewelry light | Jewelry dark | Scarves light | Scarves dark |
| --------------- | ------------- | ------------ | ------------- | ------------ |
| background      | #F2F2F5       | #000000      | #F3F1EC       | #000000      |
| surface (cell)  | #FFFFFF       | #1C1C1E      | #FFFFFF       | #1C1C1E      |
| text            | #111114       | #F5F5F7      | #14120E       | #F5F3EE      |
| secondary text  | #6C6C74       | #98989F      | #716B5C       | #A19B8C      |
| accent          | #3A43A0       | #A9B0FF      | #806229       | #D9B977      |
| accent soft     | #E7E8F7       | #272A52      | #F2E9D6       | #3A3221      |
| on accent       | #FFFFFF       | #0B0C22      | #FFFFFF       | #14120E      |
| separator       | #ECECF0       | #2C2C2E      | #EEEBE4       | #2C2C2E      |
| chevron         | #C7C7CC       | #48484A      | #C9C5BB       | #48484A      |
| segmented track | #E3E3E8       | #1C1C1E      | #E5E3DD       | #1C1C1E      |
| segmented thumb | #FFFFFF       | #3A3A3C      | #FFFFFF       | #3A3A3C      |
| warning         | #C2410C       | #FF9F6B      | #C2410C       | #FF9F6B      |

Card shadow (light only): `0 6px 18px rgba(18,20,46,0.06)` (jewelry), `rgba(30,26,19,0.06)` (scarves).

## Type

- App text: **IBM Plex Sans Arabic** (400, 500, 600, 700).
- Logos only: Playfair Display (jewelry), Cormorant Garamond (scarves).
- Scale: large title 34/700, title 22/600, headline 17/600, body 15–17/400, subhead 13–15,
  caption 11–12. Hero number 38/700. Follows the device text size setting.

## Shape and spacing

- Spacing on a 4-point grid: 4, 8, 12, 16, 20, 24, 32, 48. Screen edge padding 16.
- Corners: 8 (small), 12, 16, 22–24 (cards), 28 (hero), capsule for pills and the tab bar.

Scarves light accent darkened from #8A6A2E to #806229 so gold text on the soft gold fill reaches 4.5:1 contrast.
