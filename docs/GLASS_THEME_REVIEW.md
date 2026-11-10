# Local glass UI review

Preview: `http://127.0.0.1:5174/` (Vite; local Express API on port 3000).

The existing royal-blue theme now has frosted header, hero, cards, menus, and dialogs; a pale blue canvas; subtle white edges; and navy admin navigation. Product photography, layout breakpoints, logo assets, semantic status colors, and application behavior are preserved.

## Smoother motion

- Central easing and timing tokens in `frontend/src/styles.css`: `--ease-out`, `--motion-fast` (180 ms), and `--motion-base` (260 ms).
- Removed continuous button-shadow pulses and brightness filters on entire controls. Hover/press movements are smaller, with less overshoot.
- Dialogs, shopping-bag drawers, and menus have short, finite opacity/transform entrances. Notifications fade without moving, so their hit areas remain stable near controls. Cards lift slightly only on a fine pointer with hover support.
- Cards retain translucent surfaces without individual backdrop blur; large glass surfaces use lower blur radii, and dialog panels avoid blurring a page already blurred by the overlay. These changes reduce rendering work; device frame rates have not been benchmarked.
- Existing reduced-motion handling disables animations and transitions. Reduced-transparency and forced-color preferences have solid-surface fallbacks. Browsers without backdrop-filter support retain readable surfaces.

## Validation and scope

Production build passes. The existing isolated `npm run test:ui` harness passed all 108 layout/interaction checks with 58 mocked API calls and no runtime exceptions on rerun. An earlier run hit an intermittent mobile pagination obstruction assertion; diagnostic screenshots and hit-target logging were added for failures, and notifications now fade without a position change. UI screenshots and the latest check report are saved in `.cache/ui-preview/`.

Changes are local for review. No database records, credentials, API integrations, production configuration, commits, or deployments were changed. The local database may contain a different catalog from the live website.
