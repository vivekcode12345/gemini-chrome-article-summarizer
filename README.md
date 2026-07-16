# AI Article Summarizer

A Chrome extension that uses Google's Gemini AI to summarize web articles instantly. Get brief, detailed, or bullet-point summaries of any article with a single click.

## Features

- **Multiple Summary Types**: Choose between brief summaries, detailed summaries, or bullet-point key points
- **Smart Text Extraction**: Automatically extracts article content from various website layouts
- **One-Click Copy**: Easily copy summaries to your clipboard
- **Custom API Key**: Use your own Gemini API key for unlimited summaries
- **Works Everywhere**: Compatible with most article-based websites, blogs, and documentation

## Installation

### From Source (Developer Mode)

1. Clone or download this repository
2. Open Chrome and navigate to `chrome://extensions/`
3. Enable "Developer mode" (toggle in the top right corner)
4. Click "Load unpacked" and select the extension directory
5. The extension icon should appear in your Chrome toolbar

### Setup

1. Click the extension icon in your Chrome toolbar
2. Click the "Options" button or right-click the extension icon and select "Options"
3. Enter your Gemini API key (get one from [Google AI Studio](https://makersuite.google.com/app/apikey))
4. Save the API key

## Usage

1. Navigate to any article or webpage you want to summarize
2. Click the extension icon in your Chrome toolbar
3. Select your preferred summary type from the dropdown:
   - **Brief Summary**: 2-3 sentence overview
   - **Detailed Summary**: Comprehensive summary covering all main points
   - **Bullet Points**: 5-7 key insights in bullet format
4. Click "Summarize This Page"
5. Wait for the AI to generate the summary
6. Click "Copy Summary" to copy the result to your clipboard

## Project Structure

```
AI-ARTICLE-SUMMARIZER/
├── content.js          # Content script that extracts article text from web pages
├── popup.js            # Popup script that handles UI interactions and API calls
├── popup.html          # Popup UI markup
├── options.js          # Options page script for API key management
├── options.html        # Options page markup
├── background.js       # Service worker for background tasks
├── manifest.json       # Chrome extension manifest (Manifest V3)
├── icon.png            # Extension icon
└── README.md           # This file
```

## How It Works

1. **Content Extraction**: When you click "Summarize This Page", the extension injects `content.js` into the current tab
2. **Text Parsing**: The content script intelligently extracts article text using multiple strategies:
   - Looks for semantic HTML elements (`<article>`, `<main>`, etc.)
   - Checks common content class names (`.post-content`, `.article-content`, etc.)
   - Falls back to paragraph extraction with smart filtering
3. **API Integration**: The extracted text is sent to Google's Gemini API with a carefully crafted prompt
4. **Summary Display**: The AI-generated summary is displayed in the popup

## Technologies Used

- **Chrome Extension API** (Manifest V3)
- **Google Gemini AI** (gemini-1.5-flash model)
- **Vanilla JavaScript** (no frameworks required)

## API Key

This extension requires a Gemini API key from Google AI Studio:
- Visit [Google AI Studio](https://makersuite.google.com/app/apikey)
- Sign in with your Google account
- Create a new API key
- Paste the key in the extension options

## Troubleshooting

### "Could not extract article text from this page"

This error occurs when the extension cannot find readable content on the page. Try:
- Refreshing the page and trying again
- Checking if the page has actual article content (not just videos or images)
- Opening the browser console (F12) to check for errors

### Summary is not generating

- Verify your API key is correctly entered in the options
- Check your internet connection
- Ensure you haven't exceeded your Gemini API quota
- Try refreshing the extension in `chrome://extensions/`

## Contributing

Feel free to submit issues and enhancement requests!

## License

MIT License - feel free to use this project for personal or commercial purposes.

## Disclaimer

This extension uses Google's Gemini AI API. Please review Google's terms of service and privacy policy. The extension author is not responsible for API usage costs or data privacy.