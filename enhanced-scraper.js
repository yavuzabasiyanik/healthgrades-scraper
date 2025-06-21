import { chromium } from 'playwright';
import fs from 'fs';

async function enhancedScraper() {
  console.log('🚀 Starting enhanced Healthgrades scraper...');
  
  const browser = await chromium.launch({ 
    headless: false,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
  });
  
  const page = await context.newPage();
  
  const results = [];
  const keywords = ['obgyn', 'doula', 'gynecologist', 'birthing center'];
  
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
      
      // Look for React-rendered content
      console.log('🔍 Looking for React-rendered content...');
      let cards = await page.$$('[data-qa-target*="provider"], [data-qa-target*="doctor"], [data-qa-target*="hospital"]');
      console.log(`Found ${cards.length} cards with data-qa-target`);
      
      // If no cards found, try alternative selectors
      if (cards.length === 0) {
        console.log('🔍 Trying alternative selectors...');
        cards = await page.$$('article, .result, .card, .listing, .provider-card, .doctor-card, .hospital-card');
        console.log(`Found ${cards.length} cards with alternative selectors`);
      }
      
      // Process all found cards (limit to first 20 to avoid overwhelming)
      const maxCards = Math.min(cards.length, 20);
      console.log(`Processing ${maxCards} cards...`);
      
      for (let i = 0; i < maxCards; i++) {
        const card = cards[i];
        try {
          const provider = {
            keyword,
            name: '',
            phone: '',
            address: '',
            email: '',
            specialty: '',
            rating: '',
            reviewCount: '',
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
            'a[href*="/doctor/"]', 'a[href*="/hospital/"]',
            'span', 'div'
          ];
          
          for (const selector of nameSelectors) {
            try {
              const elements = await card.$$(selector);
              for (const element of elements) {
                const text = await element.textContent();
                if (text && text.trim() && 
                    (text.includes('Dr.') || text.includes('MD') || text.includes('DO') || 
                     text.includes('Hospital') || text.includes('Medical') || text.includes('Center') ||
                     text.includes('Clinic') || text.includes('Practice'))) {
                  provider.name = text.trim();
                  break;
                }
              }
              if (provider.name) break;
            } catch (e) {}
          }
          
          // Extract phone
          const phoneSelectors = [
            '[data-qa-target*="phone"]',
            '.phone', '.telephone',
            'a[href^="tel:"]',
            'span', 'div'
          ];
          
          for (const selector of phoneSelectors) {
            try {
              const elements = await card.$$(selector);
              for (const element of elements) {
                const text = await element.textContent();
                if (text && text.trim() && 
                    (text.match(/\(\d{3}\) \d{3}-\d{4}/) || text.match(/\d{3}-\d{3}-\d{4}/))) {
                  provider.phone = text.trim();
                  break;
                }
              }
              if (provider.phone) break;
            } catch (e) {}
          }
          
          // Extract address
          const addressSelectors = [
            '[data-qa-target*="address"]',
            '.address', '.location',
            '[data-qa-target*="location"]',
            'span', 'div'
          ];
          
          for (const selector of addressSelectors) {
            try {
              const elements = await card.$$(selector);
              for (const element of elements) {
                const text = await element.textContent();
                if (text && text.trim() && 
                    (text.includes('LA') || text.includes('Louisiana') || text.includes('St') || 
                     text.includes('Ave') || text.includes('Dr') || text.includes('Rd'))) {
                  provider.address = text.trim();
                  break;
                }
              }
              if (provider.address) break;
            } catch (e) {}
          }
          
          // Extract specialty
          const specialtySelectors = [
            '[data-qa-target*="specialty"]',
            '.specialty', '.specialization',
            'span', 'div'
          ];
          
          for (const selector of specialtySelectors) {
            try {
              const elements = await card.$$(selector);
              for (const element of elements) {
                const text = await element.textContent();
                if (text && text.trim() && 
                    (text.includes('Obstetrics') || text.includes('Gynecology') || 
                     text.includes('OBGYN') || text.includes('Doula') || 
                     text.includes('Midwife') || text.includes('Birth'))) {
                  provider.specialty = text.trim();
                  break;
                }
              }
              if (provider.specialty) break;
            } catch (e) {}
          }
          
          // Extract rating
          const ratingSelectors = [
            '[data-qa-target*="rating"]',
            '.rating', '.stars',
            'span', 'div'
          ];
          
          for (const selector of ratingSelectors) {
            try {
              const elements = await card.$$(selector);
              for (const element of elements) {
                const text = await element.textContent();
                if (text && text.trim() && 
                    (text.match(/\d+\.\d+/) || text.includes('★') || text.includes('star'))) {
                  provider.rating = text.trim();
                  break;
                }
              }
              if (provider.rating) break;
            } catch (e) {}
          }
          
          // Extract review count
          const reviewSelectors = [
            '[data-qa-target*="review"]',
            '.review-count', '.reviews',
            'span', 'div'
          ];
          
          for (const selector of reviewSelectors) {
            try {
              const elements = await card.$$(selector);
              for (const element of elements) {
                const text = await element.textContent();
                if (text && text.trim() && 
                    (text.includes('review') || text.match(/\d+ reviews?/))) {
                  provider.reviewCount = text.trim();
                  break;
                }
              }
              if (provider.reviewCount) break;
            } catch (e) {}
          }
          
          // Extract URL
          try {
            const links = await card.$$('a[href*="/doctor/"], a[href*="/hospital/"], a[href*="/provider/"]');
            for (const link of links) {
              const href = await link.getAttribute('href');
              if (href) {
                provider.url = href.startsWith('http') ? href : `https://www.healthgrades.com${href}`;
                break;
              }
            }
          } catch (e) {}
          
          // Only add if we have meaningful data
          if (provider.name || provider.phone || provider.address || provider.url) {
            results.push(provider);
            console.log(`✅ Found: ${provider.name || 'Unknown'} - ${provider.phone || 'No phone'} - ${provider.address || 'No address'}`);
          }
          
        } catch (error) {
          console.error(`Error extracting provider info from card ${i}:`, error.message);
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
    fs.writeFileSync('enhanced_results.json', JSON.stringify(results, null, 2));
    console.log(`✅ Saved ${results.length} results to enhanced_results.json`);
    
    // Also log to console
    console.log('\n📊 Results Summary:');
    results.forEach((result, index) => {
      console.log(`${index + 1}. ${result.name || 'Unknown'} - ${result.phone || 'No phone'} - ${result.address || 'No address'}`);
    });
    
    // Show statistics
    const withPhone = results.filter(r => r.phone).length;
    const withAddress = results.filter(r => r.address).length;
    const withUrl = results.filter(r => r.url).length;
    
    console.log(`\n📈 Statistics:`);
    console.log(`- Total results: ${results.length}`);
    console.log(`- With phone: ${withPhone}`);
    console.log(`- With address: ${withAddress}`);
    console.log(`- With URL: ${withUrl}`);
  } else {
    console.log('❌ No results found');
  }
  
  console.log('🏁 Scraping completed!');
}

enhancedScraper().catch(console.error); 