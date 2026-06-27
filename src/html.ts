// HTML shell + escaping. Base styles + the Turbo library live here (not in each
// generated page) so the generator can emit minimal markup, and so actions can
// patch the DOM via Turbo Streams without regenerating the page.

const ESCAPES: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};

export const escapeHtml = (value: string): string =>
  value.replace(/[&<>"']/g, (char) => ESCAPES[char] ?? char);

const BASE_STYLES = `
*{box-sizing:border-box}
body{font-family:ui-sans-serif,system-ui,sans-serif;max-width:48rem;margin:2rem auto;padding:0 1rem;line-height:1.5;color:#18181b}
a{color:#2563eb}
h1{font-size:1.6rem;margin:.2rem 0}
h2{font-size:1.15rem;margin:1.25rem 0 .5rem}
input,button,textarea,select{font:inherit}
input[type=text],input:not([type]),textarea{padding:.5rem .6rem;border:1px solid #ccc;border-radius:.4rem}
button{padding:.45rem .8rem;border:1px solid #d4d4d8;background:#f4f4f5;border-radius:.4rem;cursor:pointer}
button:hover{background:#ececef}
form{display:inline}
ul#sj-items{list-style:none;padding:0;margin:1rem 0}
.sj-item{display:flex;align-items:center;gap:.6rem;padding:.4rem .25rem;border-bottom:1px solid #eee}
.sj-text{flex:1}
.muted{color:#71717a}
pre{background:#f4f4f5;padding:1rem;border-radius:.5rem;overflow-x:auto}
code{background:#f4f4f5;padding:.1rem .3rem;border-radius:.25rem}
`.trim();

// Open of the document through <body> — sent first so the page paints immediately.
// Turbo is loaded here (auto-starts) to enable Turbo Streams + Drive.
export const pageHead = (title: string): string =>
  `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${escapeHtml(title)}</title>
<script src="/_assets/turbo.js"></script>
<style>${BASE_STYLES}</style>
</head>
<body>
`;

export const pageClose = (): string => `\n</body>\n</html>`;

export const page = (title: string, body: string): string =>
  `${pageHead(title)}${body}${pageClose()}`;
