# Getting Started

## Run locally

1. Open a terminal in the project folder.
2. Run npm install once.
3. Run npm start.
4. Open http://localhost:8080.

The local process serves the browser assets only. Browsing traffic is initiated
in the browser and sent to the public Wisp endpoint configured in
public/config.js.

## Use the browser

- Use the plus button to open an independent tab.
- Use the left and right arrows to navigate that tab's own history.
- Use Quick links for the five preset destinations.
- Open Settings to control the launch overlay and keyboard shortcut.

## Deploy to Vercel

The Vercel configuration publishes public as a static output directory. The
build copies Scramjet, BareMux, and libcurl browser assets into that directory,
so browsing requests do not invoke a Vercel serverless function.

Use HTTPS outside localhost because service workers require a secure context.
