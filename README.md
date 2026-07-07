# Simsi Solutions

A static web app (Productive). Plain HTML, CSS, and JavaScript — no build step.

## Files

- `index.html` — app entry point
- `styles.css` — styles
- `app.js` — application logic
- `Backgrounds/`, `Fonts/` — static assets

## Run locally

Open `index.html` directly in a browser, or serve the folder:

```bash
python3 -m http.server 8000
# then open http://localhost:8000
```

## Deploy on Vercel

This is a zero-config static site. Import the repo at
[vercel.com/new](https://vercel.com/new) and deploy — Vercel serves the files
from the repo root with no build command needed.
