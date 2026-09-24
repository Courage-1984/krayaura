# Ambient video loops

Drop generated clips here, then run `python scripts/copy-media.py` (needs ffmpeg on PATH).
Each file becomes a silent H.264 .mp4 + VP9 .webm + poster in `public/media/video/` and is
listed in `src/data/video.json`. The site picks them up automatically.

| File name | Used for |
| --- | --- |
| `crash-loop.mp4` (16:9) | Behind the pinned CRASH story (desktop) |
| `crash-loop-portrait.mp4` (9:16, optional) | Same, on phones |
| `crash-cover.mp4` (16:9 or 1:1) | The real CRASH cover, animated — centre-cropped to a square automatically, replaces the still in the CRASH section |

Keep loops 6–10 s, seamless, no text, no people, no audio.


