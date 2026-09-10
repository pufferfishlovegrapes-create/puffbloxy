# Configuration

## Browser settings

Open the gear button in the browser to change these settings:

- Show blocked image on launch controls whether blocked.png opens above the
  browser.
- Enable keyboard unlock shortcut controls whether the Konami keyup sequence
  can close that image.

Both settings are saved and validated in the current browser profile.

## Quick links and browser transport

Edit public/config.js to change the five Quick links or the public Wisp
endpoint pool. Endpoint selection and rotation are performed in the browser;
no private key, server-side proxy process, or environment variable is needed.

Use public Wisp endpoints that you operate or trust. The repository includes
the Mercury Workshop public endpoint as a working default.
