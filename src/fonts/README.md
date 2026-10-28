# Fonts

Bundled by Vite from `src/styles/tokens.css` (relative `url("../fonts/…")`), so they get
content-hashed filenames and the right base path automatically.

Rebuild the brand files with `python scripts/build-fonts.py` (reads `Updated fonts/`).

| Family            | Files                                      | Role                          |
| ----------------- | ------------------------------------------ | ----------------------------- |
| Righteous         | `righteous-latin.woff2`                    | Headings / display            |
| Poppins           | `poppins-latin-*.woff2`                    | Sub-heads, labels, UI         |
| A Dripping Marker | `a-dripping-marker.woff2`                  | The word "M.I.A." only        |
| Source Sans 3     | `source-sans-3-latin-400/600.woff2`        | Body copy                     |

Righteous is one cut. The same file is registered at weights 400 and 700, and for italic,
with `size-adjust: 70%` so existing heading sizes keep the width they had under Bolde Bold.
`font-synthesis: none` on headings stops the browser inventing a bold or an oblique.

Poppins is the Latin subset of Regular, Italic, Medium (500), Bold, and Bold Italic.
Those are the weights the CSS actually asks for.

A Dripping Marker is subset to `M`, `I`, `A`, and `.`. Its `@font-face` crops the em
(`ascent-override` / `descent-override`) so the drips sit inside the line box.
Righteous and Poppins are SIL Open Font License (licence texts live in `Updated fonts/`).
A Dripping Marker shipped as freeware from FontSpace (`Updated fonts/a-dripping-marker-font/info.txt`);
there is no separate licence file, and the commercial-embedding terms were not independently confirmed.

Proxima Nova is **not** loaded: the only copies are Fontspring DEMO files, which watermark
spaces/hyphens and aren't licensed for the web. They live in `assets/fonts/proxima-nova-demo/`
so they can never deploy. Drop licensed `.woff2` files here and add `@font-face` rules to use it.
