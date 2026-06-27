// Tiny HTML helpers for the M1 server (no templating engine yet).

const ESCAPES: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};

export const escapeHtml = (value: string): string =>
  value.replace(/[&<>"']/g, (char) => ESCAPES[char] ?? char);

export const page = (title: string, body: string): string =>
  `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${escapeHtml(title)}</title>
<style>
  body { font-family: ui-sans-serif, system-ui, sans-serif; max-width: 48rem; margin: 2rem auto; padding: 0 1rem; line-height: 1.5; color: #18181b; }
  a { color: #2563eb; }
  pre { background: #f4f4f5; padding: 1rem; border-radius: .5rem; overflow-x: auto; }
  code { background: #f4f4f5; padding: .1rem .3rem; border-radius: .25rem; }
  .muted { color: #71717a; }
</style>
</head>
<body>
${body}
</body>
</html>`;
