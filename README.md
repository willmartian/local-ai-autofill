# Local AI Autofill

A Chrome extension demo that uses Chrome's built-in [Prompt API](https://developer.chrome.com/docs/ai/prompt-api) (Gemini Nano, on-device) to autofill web forms. The extension shows a hardcoded persona in the popup and uses the AI to map that data to the fields of whatever form is on the active tab — no network requests, no external API keys.

https://github.com/user-attachments/assets/5c80efdf-4a2a-4237-ba06-0cd22fa2b38a

## Prerequisites

- Chrome 131+

## Running locally

```bash
pnpm install
pnpm dev
```

WXT will launch a Chrome instance with the extension loaded. Open any page with a form, click the extension icon, and hit **Autofill this page**.
