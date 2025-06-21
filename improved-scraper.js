import { chromium } from 'playwright';
import fs from 'fs';

async function improvedScraper() {
  console.log('🚀 Starting improved Healthgrades scraper...');
  
  const browser = await chromium.launch({ 
    headless: false, // Run in visible mode for debugging
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
      await page.goto(url, { 
        waitUntil: 'domcontentloaded',
        timeout: 60000 
      });
      
      console.log(`📄 Loaded page: ${url}`);
      
      // Wait for the page to fully load and render
      await page.waitForTimeout(5000);
      
      // Wait for any loading indicators to disappear
      try {
        await page.waitForSelector('[data-qa-target="loading"], .loading, .spinner', { 
          state: 'hidden',
          timeout: 10000 
        });
      } catch (e) {
        console.log('No loading indicator found or already loaded');
      }
      
      // Try multiple approaches to find results
      let cards = [];
      
      // Approach 1: Look for React-rendered content
      console.log('🔍 Looking for React-rendered content...');
      cards = await page.$$('[data-qa-target*="provider"], [data-qa-target*="doctor"], [data-qa-target*="hospital"]');
      console.log(`Found ${cards.length} cards with data-qa-target`);
      
      // Approach 2: Look for common result containers
      if (cards.length === 0) {
        console.log('🔍 Looking for result containers...');
        cards = await page.$$('article, .result, .card, .listing, .provider-card, .doctor-card, .hospital-card');
        console.log(`Found ${cards.length} cards with generic selectors`);
      }
      
      // Approach 3: Look for any clickable elements that might be provider links
      if (cards.length === 0) {
        console.log('🔍 Looking for provider links...');
        const links = await page.$$('a[href*="/doctor/"], a[href*="/hospital/"], a[href*="/provider/"]');
        console.log(`Found ${links.length} provider links`);
        
        // Convert links to cards for processing
        for (const link of links) {
          const parent = await link.$('..');
          if (parent) {
            cards.push(parent);
          }
        }
      }
      
      // Approach 4: Look for any content that might contain provider information
      if (cards.length === 0) {
        console.log('🔍 Looking for any content with provider info...');
        const allElements = await page.$$('div, article, section');
        console.log(`Found ${allElements.length} potential content elements`);
        
        // Filter elements that might contain provider info
        for (const element of allElements) {
          try {
            const text = await element.textContent();
            if (text && (text.includes('Dr.') || text.includes('MD') || text.includes('DO') || text.includes('Hospital') || text.includes('Medical'))) {
              cards.push(element);
            }
          } catch (e) {}
        }
        console.log(`Filtered to ${cards.length} elements with provider-like content`);
      }
      
      // Process found cards
      for (let i = 0; i < Math.min(cards.length, 10); i++) {
        const card = cards[i];
        try {
          const provider = {
            keyword,
            name: '',
            phone: '',
            address: '',
            email: '',
            rating: '',
            url: '',
            rawText: ''
          };
          
          // Get raw text for debugging
          try {
            provider.rawText = await card.textContent();
          } catch (e) {}
          
          // Extract name - try multiple approaches
          const nameSelectors = [
            'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
            '[data-qa-target*="name"]',
            '.name', '.provider-name', '.doctor-name',
            'a[href*="/doctor/"]', 'a[href*="/hospital/"]'
          ];
          
          for (const selector of nameSelectors) {
            try {
              const element = await card.$(selector);
              if (element) {
                provider.name = await element.textContent();
                if (provider.name && provider.name.trim()) {
                  provider.name = provider.name.trim();
                  break;
                }
              }
            } catch (e) {}
          }
          
          // Extract phone
          const phoneSelectors = [
            '[data-qa-target*="phone"]',
            '.phone', '.telephone',
            'a[href^="tel:"]'
          ];
          
          for (const selector of phoneSelectors) {
            try {
              const element = await card.$(selector);
              if (element) {
                provider.phone = await element.textContent();
                if (provider.phone && provider.phone.trim()) {
                  provider.phone = provider.phone.trim();
                  break;
                }
              }
            } catch (e) {}
          }
          
          // Extract address
          const addressSelectors = [
            '[data-qa-target*="address"]',
            '.address', '.location',
            '[data-qa-target*="location"]'
          ];
          
          for (const selector of addressSelectors) {
            try {
              const element = await card.$(selector);
              if (element) {
                provider.address = await element.textContent();
                if (provider.address && provider.address.trim()) {
                  provider.address = provider.address.trim();
                  break;
                }
              }
            } catch (e) {}
          }
          
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
          
          // Only add if we have some meaningful data
          if (provider.name || provider.phone || provider.address || provider.url) {
            results.push(provider);
            console.log(`✅ Found: ${provider.name || 'Unknown'} - ${provider.phone || 'No phone'} - ${provider.address || 'No address'}`);
          }
          
        } catch (error) {
          console.error('Error extracting provider info:', error.message);
        }
      }
      
      // Take a screenshot for debugging
      await page.screenshot({ path: `debug-${keyword}.png`, fullPage: true });
      console.log(`📸 Screenshot saved as debug-${keyword}.png`);
      
      // Delay between keywords
      await page.waitForTimeout(3000);
      
    } catch (error) {
      console.error(`❌ Error scraping ${keyword}:`, error.message);
    }
  }
  
  await browser.close();
  
  // Save results
  if (results.length > 0) {
    fs.writeFileSync('improved_results.json', JSON.stringify(results, null, 2));
    console.log(`✅ Saved ${results.length} results to improved_results.json`);
    
    // Also log to console
    console.log('\n📊 Results:');
    results.forEach((result, index) => {
      console.log(`${index + 1}. ${result.name || 'Unknown'} - ${result.phone || 'No phone'} - ${result.address || 'No address'}`);
    });
  } else {
    console.log('❌ No results found');
  }
  
  console.log('🏁 Scraping completed!');
}

improvedScraper().catch(console.error); 