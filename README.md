# Healthgrades Louisiana Scraper

A Node.js/Playwright scraper to extract OB-GYNs, hospitals, doulas, and women's health providers from Healthgrades.com in Louisiana.

## Features

- 🔍 Scrapes multiple healthcare provider types (OB-GYNs, doulas, gynecologists, birthing centers, hospitals)
- 📄 Handles pagination automatically
- 🛡️ Built-in error handling and retry logic
- 📊 Exports data to both CSV and JSON formats
- ⏱️ Respectful scraping with delays between requests
- 🎯 Multiple selector strategies for robust data extraction

## Data Extracted

For each provider, the scraper captures:
- **Name** - Provider or institution name
- **Phone** - Contact phone number
- **Address** - Practice location
- **Email** - Contact email (if available)
- **Specialty** - Medical specialty
- **Rating** - Healthgrades rating
- **Review Count** - Number of reviews
- **Profile URL** - Link to full profile

## Setup

1. **Install Node.js** (version 16 or higher)

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Install Playwright browsers:**
   ```bash
   npm run install-browsers
   ```

## Usage

### Basic Usage
```bash
npm start
```

### Custom Keywords
Edit the `keywords` array in `scraper.js` to search for different provider types:

```javascript
const keywords = [
  'obgyn',
  'obstetrician gynecologist', 
  'doula',
  'gynecologist',
  'birthing center',
  'hospital',
  'women\'s health clinic',
  'midwife'
];
```

### Configuration Options

You can modify these settings in `scraper.js`:

- **Max pages per keyword**: Change `maxPages` parameter in `scrapeKeyword()` calls
- **Delay between requests**: Modify `delay()` calls for different timing
- **Output format**: Results are saved to both CSV and JSON by default

## Output Files

The scraper generates two output files:

1. **`healthgrades_results.csv`** - Spreadsheet-friendly format
2. **`healthgrades_results.json`** - Structured data format

## Sample Output

```json
{
  "keyword": "obgyn",
  "name": "Dr. Jane Smith",
  "phone": "(555) 123-4567",
  "address": "123 Medical Center Dr, New Orleans, LA 70112",
  "email": "",
  "specialty": "Obstetrics & Gynecology",
  "rating": "4.5",
  "reviewCount": "127 reviews",
  "url": "https://www.healthgrades.com/doctor/dr-jane-smith-12345"
}
```

## Error Handling

The scraper includes robust error handling:
- Network timeouts and retries
- Missing data field handling
- Graceful degradation when selectors change
- Detailed logging for debugging

## Legal and Ethical Considerations

⚠️ **Important**: Web scraping may be subject to terms of service and legal restrictions. Please ensure you:

- Review Healthgrades.com's Terms of Service
- Respect robots.txt and rate limiting
- Use data responsibly and in compliance with applicable laws
- Consider reaching out to Healthgrades for API access if available

## Troubleshooting

### Common Issues

1. **No results found**: The website structure may have changed. Check the console output for selector information.

2. **Browser launch errors**: Ensure you've run `npm run install-browsers`

3. **Network timeouts**: Increase timeout values in the code or check your internet connection

4. **Rate limiting**: Increase delays between requests if you encounter blocking

### Debug Mode

To run in non-headless mode for debugging:
```javascript
// In scraper.js, change:
headless: false
```

## Contributing

Feel free to submit issues and enhancement requests!

## License

MIT License - see LICENSE file for details. # healthgrades-scraper
