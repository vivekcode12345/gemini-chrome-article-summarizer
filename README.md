<div align="center">

# AI Summary for Articles

**A Chrome extension that leverages Google's Gemini AI to instantly summarize any article on the web.**

Choose between brief, detailed, or bullet-point summaries — generated with a single click, directly from your browser toolbar.

</div>

---

## Overview

AI Summary for Articles is a lightweight, Manifest V3 Chrome extension that extracts readable text from any web page and sends it to Google's Gemini API to produce a concise, structured summary. It is built with vanilla JavaScript, requires no build tools, and is fully open source under the MIT License.

## Features

- **Multiple Summary Modes** — Brief (2–3 sentences), Detailed (comprehensive), or Bullet Points (5–7 key takeaways).
- **Intelligent Text Extraction** — Falls back through semantic HTML, common content containers, and heuristic paragraph filtering to find article content.
- **Bring Your Own API Key** — Your Gemini API key is stored locally in Chrome's storage. Nothing is sent to a third party.
- **One-Click Copy** — Instantly copy any summary to your clipboard.
- **Modern & Secure** — Built on Manifest V3 using service workers and minimal permissions.

## Demo

> _Add a screenshot or short GIF of the popup and a generated summary here to showcase the extension in action._

## Installation

### Option A — From Source (Recommended for Development)

1. Clone the repository:
   ```bash
   git clone https://github.com/vivekcode12345/gemini-chrome-article-summarizer.git
   ```
2. Open Chrome and navigate to `chrome://extensions/`.
3. Enable **Developer mode** using the toggle in the top-right corner.
4. Click **Load unpacked** and select the cloned project directory.
5. The **AI Summary for Articles** icon will appear in your Chrome toolbar.

### Option B — From the Chrome Web Store

> _Link to the published extension once available._

## Configuration

1. Click the extension icon and choose **Options** (or right-click the icon → *Options*).
2. Generate a free API key at [Google AI Studio](https://makersuite.google.com/app/apikey).
3. Paste the key into the options page and click **Save**.

Your key is stored locally via `chrome.storage.local` and is never transmitted outside of Google's Gemini API.

## Usage

1. Open any article, blog post, or documentation page.
2. Click the extension icon in your toolbar.
3. Select your preferred summary mode.
4. Click **Summarize This Page**.
5. Click **Copy Summary** to copy the result.

## Project Structure

```
gemini-chrome-article-summarizer/
├── manifest.json       # Extension manifest (Manifest V3)
├── background.js       # Service worker
├── content.js          # Content script for article extraction
├── popup.html          # Popup UI markup
├── popup.js            # Popup logic and Gemini API calls
├── options.html        # Options page markup
├── options.js          # Options page logic and API key validation
├── icon.png            # Extension icon
└── README.md
```

## How It Works

1. **Text Extraction** — The content script identifies the main article content using a layered strategy:
   - Semantic elements (`<article>`, `<main>`)
   - Common content class names (`.post-content`, `.article-body`, etc.)
   - Paragraph-density heuristics as a final fallback
2. **Prompt Construction** — The extracted text is combined with a mode-specific prompt.
3. **Summarization** — A request is made to the Gemini API (`gemini-3.6-flash`).
4. **Display** — The response is rendered in the popup with a one-click copy action.

## Tech Stack

| Layer            | Technology                      |
| ---------------- | ------------------------------- |
| Extension Type   | Chrome Extension (Manifest V3)  |
| Language         | JavaScript (ES2020+) — no build step |
| AI Backend      | Google Gemini API (`gemini-3.6-flash`) |
| Storage         | `chrome.storage.local`          |

## Privacy

- Your API key never leaves your browser except to authenticate with Google's Gemini API.
- Article text is sent directly from your browser to Google — there is no intermediary.
- No analytics, no telemetry, no third-party tracking.

## Troubleshooting

**"Could not extract article text from this page"**
- Refresh the page and try again.
- The page may be primarily video/image content with no readable text.
- Open DevTools (`F12`) and check the console for additional details.

**Summary is not generating**
- Verify your API key is correctly entered in the options page.
- Confirm your internet connection is active.
- Ensure you have not exceeded the Gemini API free-tier quota.
- Reload the extension from `chrome://extensions/`.

## Roadmap

- [ ] Support for selecting arbitrary page text as input
- [ ] Custom summary length control
- [ ] Multi-language summaries
- [ ] Optional caching of recent summaries
- [ ] Publish to the Chrome Web Store

## Contributing

Contributions are welcome. Please open an issue first to discuss what you would like to change, then submit a pull request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'feat: add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

Distributed under the **MIT License**. See `LICENSE` for more information.

## Disclaimer

This project is not affiliated with Google. Use of the Gemini API is subject to [Google's Terms of Service](https://policies.google.com/terms). You are responsible for any API usage costs incurred through your own API key.

---

<div align="center">

Made with care by [vivekcode12345](https://github.com/vivekcode12345)

</div>