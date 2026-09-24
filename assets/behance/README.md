# Behance projects

One folder per project. `python scripts/copy-media.py` turns each folder into a swipeable
gallery in the Design section's lightbox.

```
assets/behance/<project-slug>/
  cover.jpg          ← list preview (already here, from the Behance profile)
  01.jpg, 02.jpg…    ← gallery images, shown in filename order (jpg/png/webp, any size)
  description.txt    ← optional; replaces the one-line description on the site
```

Current projects:
- `koketso-ramogale-portfolio/` — https://www.behance.net/gallery/181718011/Koketso-Ramogale-Portfolio
- `connected-to-the-future/` — https://www.behance.net/gallery/176724099/Connected-to-the-future

To add a new project: make a new folder, then add an entry to `projects` in `src/js/content.js`
with `gallery: "<project-slug>"`.
