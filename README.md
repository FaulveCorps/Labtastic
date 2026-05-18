# Labtastic

Labtastic is a lightweight browser game that turns the periodic table into an element-combining sandbox. Players unlock compounds by dragging or tapping elements into the combine area and experimenting with valid reactions.

## Project structure

- `index.html` contains the app layout and user interface.
- `style.css` defines the visual styling, animations, and responsive layout.
- `script.js` handles rendering, filtering, unlocking, history, and interaction logic.
- `media/elements.json` stores the element dataset used by the app.
- `media/elements-data.js` exposes the same dataset as an inline browser-friendly script.
- `media/` also contains the logo and favicon assets.

## Running locally

Because the project is a static site, you can run it with any simple file server.

Examples:

- `python -m http.server`
- `npx serve .`

Then open the reported local URL in a browser.

## Gameplay notes

- The app starts with a small set of unlocked elements.
- Combine two or more elements in the workspace to discover new results.
- Use the search box and block filter to narrow the periodic table.
- Combination history, filter preferences, tutorial state, and unlocked progress are stored in `localStorage` in the browser.

## Data and privacy

- The repository no longer ships with personally attributed carousel content.
- The app does not send player data to a backend service.
- Browser storage is only used for local progress and UI preferences on the current device.
