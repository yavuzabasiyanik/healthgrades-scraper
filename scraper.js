import { chromium } from 'playwright';
import { createObjectCsvWriter } from 'csv-writer';
import fs from 'fs';
import path from 'path';

class HealthgradesScraper {
  constructor() {
    this.browser = null;
    this.page = null;
    this.results = [];
    this.csvWriter = null;
  }

  async initialize() {
    console.log('🚀 Initializing scraper...');
    this.browser = await chromium.launch({ 
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    
    const context = await this.browser.newContext({
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    });
    
    this.page = await context.newPage();
    
    // Set up CSV writer
    this.csvWriter = createObjectCsvWriter({
      path: 'healthgrades_results.csv',
      header: [
        { id: 'keyword', title: 'Search Keyword' },
        { id: 'name', title: 'Name' },
        { id: 'phone', title: 'Phone' },
        { id: 'address', title: 'Address' },
        { id: 'email', title: 'Email' },
        { id: 'specialty', title: 'Specialty' },
        { id: 'rating', title: 'Rating' },
        { id: 'reviewCount', title: 'Review Count' },
        { id: 'url', title: 'Profile URL' }
      ]
    });

    console.log('✅ Scraper initialized successfully');
  }

  async scrapeKeyword(keyword, maxPages = 5) {
    console.log(`🔍 Scraping for: ${keyword}`);
    
    const baseUrl = `https://www.healthgrades.com/usearch?what=${encodeURIComponent(keyword)}&where=Louisiana`;
    let currentPage = 1;
    let hasMorePages = true;

    while (hasMorePages && currentPage <= maxPages) {
      const url = currentPage === 1 ? baseUrl : `${baseUrl}&page=${currentPage}`;
      console.log(`📄 Processing page ${currentPage}: ${url}`);

      try {
        await this.page.goto(url, { 
          waitUntil: 'networkidle',
          timeout: 30000 
        });

        // Wait for results to load
        await this.page.waitForSelector('[data-qa-target="provider-result-card"], .provider-card, .search-result', { 
          timeout: 10000 
        }).catch(() => console.log('No provider cards found on this page'));

        // Extract data from current page
        const pageResults = await this.extractProviderData(keyword);
        
        if (pageResults.length === 0) {
          console.log(`No more results found on page ${currentPage}`);
          hasMorePages = false;
        } else {
          this.results.push(...pageResults);
          console.log(`✅ Found ${pageResults.length} providers on page ${currentPage}`);
          
          // Check if there's a next page
          const nextButton = await this.page.$('[data-qa-target="pagination-next"], .pagination-next, .next-page');
          if (!nextButton) {
            hasMorePages = false;
          }
        }

        currentPage++;
        
        // Add delay between pages to be respectful
        await this.delay(2000);

      } catch (error) {
        console.error(`❌ Error scraping page ${currentPage} for ${keyword}:`, error.message);
        hasMorePages = false;
      }
    }

    console.log(`✅ Completed scraping for ${keyword}. Total results: ${this.results.length}`);
  }

  async extractProviderData(keyword) {
    const providers = [];
    
    // Try multiple selectors for provider cards
    const cardSelectors = [
      '[data-qa-target="provider-result-card"]',
      '.provider-card',
      '.search-result',
      '.provider-result',
      '[data-testid="provider-card"]'
    ];

    let cards = [];
    for (const selector of cardSelectors) {
      cards = await this.page.$$(selector);
      if (cards.length > 0) {
        console.log(`Found ${cards.length} cards using selector: ${selector}`);
        break;
      }
    }

    for (const card of cards) {
      try {
        const provider = await this.extractProviderInfo(card, keyword);
        if (provider.name) {
          providers.push(provider);
        }
      } catch (error) {
        console.error('Error extracting provider info:', error.message);
      }
    }

    return providers;
  }

  async extractProviderInfo(card, keyword) {
    const provider = {
      keyword,
      name: '',
      phone: '',
      address: '',
      email: '',
      specialty: '',
      rating: '',
      reviewCount: '',
      url: ''
    };

    // Extract name
    const nameSelectors = [
      '[data-qa-target="provider-name"]',
      '.provider-name',
      'h3',
      '.name',
      '[data-testid="provider-name"]'
    ];
    
    for (const selector of nameSelectors) {
      try {
        provider.name = await card.$eval(selector, el => el.textContent.trim());
        if (provider.name) break;
      } catch (e) {}
    }

    // Extract phone
    const phoneSelectors = [
      '[data-qa-target="provider-phone"]',
      '.provider-phone',
      '.phone',
      '[data-testid="phone"]'
    ];
    
    for (const selector of phoneSelectors) {
      try {
        provider.phone = await card.$eval(selector, el => el.textContent.trim());
        if (provider.phone) break;
      } catch (e) {}
    }

    // Extract address
    const addressSelectors = [
      '[data-qa-target="provider-practice-location"]',
      '.provider-address',
      '.address',
      '.location',
      '[data-testid="address"]'
    ];
    
    for (const selector of addressSelectors) {
      try {
        provider.address = await card.$eval(selector, el => el.textContent.trim());
        if (provider.address) break;
      } catch (e) {}
    }

    // Extract rating
    const ratingSelectors = [
      '.rating',
      '.stars',
      '[data-qa-target="provider-rating"]',
      '.review-rating'
    ];
    
    for (const selector of ratingSelectors) {
      try {
        provider.rating = await card.$eval(selector, el => el.textContent.trim());
        if (provider.rating) break;
      } catch (e) {}
    }

    // Extract review count
    const reviewSelectors = [
      '.review-count',
      '.reviews',
      '[data-qa-target="review-count"]'
    ];
    
    for (const selector of reviewSelectors) {
      try {
        provider.reviewCount = await card.$eval(selector, el => el.textContent.trim());
        if (provider.reviewCount) break;
      } catch (e) {}
    }

    // Extract profile URL
    try {
      const linkElement = await card.$('a[href*="/doctor/"], a[href*="/hospital/"], a[href*="/provider/"]');
      if (linkElement) {
        provider.url = await linkElement.getAttribute('href');
        if (provider.url && !provider.url.startsWith('http')) {
          provider.url = `https://www.healthgrades.com${provider.url}`;
        }
      }
    } catch (e) {}

    return provider;
  }

  async delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async saveResults() {
    if (this.results.length === 0) {
      console.log('No results to save');
      return;
    }

    try {
      // Save to CSV
      await this.csvWriter.writeRecords(this.results);
      console.log(`✅ Results saved to healthgrades_results.csv`);

      // Save to JSON
      fs.writeFileSync('healthgrades_results.json', JSON.stringify(this.results, null, 2));
      console.log(`✅ Results saved to healthgrades_results.json`);

      console.log(`📊 Total results: ${this.results.length}`);
    } catch (error) {
      console.error('❌ Error saving results:', error);
    }
  }

  async close() {
    if (this.browser) {
      await this.browser.close();
      console.log('🔒 Browser closed');
    }
  }
}

async function main() {
  const scraper = new HealthgradesScraper();
  
  try {
    await scraper.initialize();

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

    for (const keyword of keywords) {
      await scraper.scrapeKeyword(keyword, 3); // Limit to 3 pages per keyword
      await scraper.delay(3000); // Delay between keywords
    }

    await scraper.saveResults();

  } catch (error) {
    console.error('❌ Fatal error:', error);
  } finally {
    await scraper.close();
  }
}

// Run the scraper
main().catch(console.error); 