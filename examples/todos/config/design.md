# Design

The visual design is owned by the framework (the page shell), NOT by the page
generator — so the app looks consistent on every load instead of re-themed each
visit.

- system: pico
- mode: structure-only

The generator emits semantic HTML only (no styles, colors, or theme classes);
Pico.css — a classless theme served at `/_assets/pico.css` — styles it. Picking a
different design system, or moving to a pre-styled component catalog, is future
work (REQUIREMENTS §11). _Note: the generator currently hardcodes this; reading it
from here is part of "configure the webpage generator" (§11)._
