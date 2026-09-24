# Fonts

Bundled by Vite from `src/styles/tokens.css` (relative `url("../fonts/…")`), so they get
content-hashed filenames and the right base path automatically.

| Family      | Files                                 | Role                   |
| ----------- | ------------------------------------- | ---------------------- |
| Bolde       | `bolde-*.woff2` (light → bold, hollow) | Headings / display     |
| Black Pro   | `black-pro-*.woff2`                    | Sub-heads, labels, UI  |
| Source Sans 3 | Google Fonts (index.html)            | Body copy              |

Proxima Nova is **not** loaded: the only copies are Fontspring DEMO files, which watermark
spaces/hyphens and aren't licensed for the web. They live in `assets/fonts/proxima-nova-demo/`
so they can never deploy. Drop licensed `.woff2` files here and add `@font-face` rules to use it.
