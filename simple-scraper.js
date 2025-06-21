import { chromium } from 'playwright';
import fs from 'fs';

async function simpleScraper() {
  console.log('🚀 Starting simple Healthgrades scraper...');
  
  const browser = await chromium.launch({ 
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
  });
  
  const page = await context.newPage();
  
  const results = [];
  const keywords = ['obgyn', 'doula'];
  
  for (const keyword of keywords) {
    console.log(`🔍 Scraping for: ${keyword}`);
    
    try {
      const url = `https://www.healthgrades.com/usearch?what=${encodeURIComponent(keyword)}&where=Louisiana`;
      await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
      
      console.log(`📄 Loaded page: ${url}`);
      
      // Wait a bit for content to load
      await page.waitForTimeout(3000);
      
      // Try to find provider cards
      const cards = await page.$$('[data-qa-target="provider-result-card"], .provider-card, .search-result, .provider-result');
      console.log(`Found ${cards.length} provider cards`);
      
      for (let i = 0; i < Math.min(cards.length, 5); i++) { // Limit to first 5 results
        const card = cards[i];
        try {
          const provider = {
            keyword,
            name: '',
            phone: '',
            address: '',
            email: '',
            rating: '',
            url: ''
          };
          
          // Extract name
          try {
            provider.name = await card.$eval('[data-qa-target="provider-name"], .provider-name, h3, .name', el => el.textContent.trim());
          } catch (e) {}
          
          // Extract phone
          try {
            provider.phone = await card.$eval('[data-qa-target="provider-phone"], .provider-phone, .phone', el => el.textContent.trim());
          } catch (e) {}
          
          // Extract address
          try {
            provider.address = await card.$eval('[data-qa-target="provider-practice-location"], .provider-address, .address, .location', el => el.textContent.trim());
          } catch (e) {}
          
          // Extract rating
          try {
            provider.rating = await card.$eval('.rating, .stars, [data-qa-target="provider-rating"]', el => el.textContent.trim());
          } catch (e) {}
          
          // Extract URL
          try {
            const link = await card.$('a[href*="/doctor/"], a[href*="/hospital/"], a[href*="/provider/"]');
            if (link) {
              provider.url = await link.getAttribute('href');
              if (provider.url && !provider.url.startsWith('http')) {
                provider.url = `https://www.healthgrades.com${provider.url}`;
              }
            }
          } catch (e) {}
          
          if (provider.name) {
            results.push(provider);
            console.log(`✅ Found: ${provider.name}`);
          }
          
        } catch (error) {
          console.error('Error extracting provider info:', error.message);
        }
      }
      
      // Delay between keywords
      await page.waitForTimeout(2000);
      
    } catch (error) {
      console.error(`❌ Error scraping ${keyword}:`, error.message);
    }
  }
  
  await browser.close();
  
  // Save results
  if (results.length > 0) {
    fs.writeFileSync('simple_results.json', JSON.stringify(results, null, 2));
    console.log(`✅ Saved ${results.length} results to simple_results.json`);
    
    // Also log to console
    console.log('\n📊 Results:');
    results.forEach((result, index) => {
      console.log(`${index + 1}. ${result.name} - ${result.phone} - ${result.address}`);
    });
  } else {
    console.log('❌ No results found');
  }
  
  console.log('🏁 Scraping completed!');
}

simpleScraper().catch(console.error); 