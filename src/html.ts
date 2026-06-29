// HTML shell + escaping. The shell owns the ENTIRE visual design: Pico.css (a
// classless design system) gives a consistent theme on every load, so generated
// pages contain only semantic structure — no per-page styling, no reload-roulette.
// Turbo is loaded here too (Streams + Drive).

const ESCAPES: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};

export const escapeHtml = (value: string): string =>
  value.replace(/[&<>"']/g, (char) => ESCAPES[char] ?? char);

// Only layout glue for the framework's own list rows — the theme comes from Pico.
const SHELL_STYLES = `
main.container{max-width:46rem}
#sj-items{list-style:none;padding:0}
.sj-item{display:flex;align-items:center;gap:.5rem;padding:.35rem 0;border-bottom:1px solid var(--pico-muted-border-color,#e5e5e5)}
.sj-item form{display:inline;margin:0}
.sj-item button{width:auto;margin:0;padding:.15rem .6rem}
.sj-text{flex:1}
`.trim();

// Open of the document through <body> — sent first so the page paints immediately.
export const pageHead = (title: string): string =>
  `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${escapeHtml(title)}</title>
<link rel="stylesheet" href="/_assets/pico.css" />
<script src="/_assets/turbo.js"></script>
<style>${SHELL_STYLES}</style>
</head>
<body>
<main class="container">
`;

export const pageClose = (): string => `\n</main>\n</body>\n</html>`;

export const page = (title: string, body: string): string =>
  `${pageHead(title)}${body}${pageClose()}`;
