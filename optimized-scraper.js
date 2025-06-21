import { chromium } from 'playwright';
import fs from 'fs';

async function optimizedScraper() {
  console.log('🚀 Starting optimized Healthgrades scraper with better data quality...');
  
  const browser = await chromium.launch({ 
    headless: false,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
  });
  
  const page = await context.newPage();
  
  const results = [];
  const keywords = ['obgyn', 'doula', 'gynecologist', 'birthing center', 'midwife'];
  
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
      
      // Look for provider cards with more specific selectors
      console.log('🔍 Looking for provider cards...');
      let cards = await page.$$('[data-qa-target*="provider"], [data-qa-target*="doctor"], [data-qa-target*="hospital"]');
      console.log(`Found ${cards.length} cards with data-qa-target`);
      
      // If no cards found, try alternative selectors
      if (cards.length === 0) {
        console.log('🔍 Trying alternative selectors...');
        cards = await page.$$('article, .result, .card, .listing, .provider-card, .doctor-card, .hospital-card');
        console.log(`Found ${cards.length} cards with alternative selectors`);
      }
      
      // Process all found cards (limit to first 50 to get more results)
      const maxCards = Math.min(cards.length, 50);
      console.log(`Processing ${maxCards} cards...`);
      
      let processedCount = 0;
      
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
            isValid: false
          };
          
          // Extract name - focus on actual provider names
          const nameSelectors = [
            'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
            '[data-qa-target*="name"]',
            '.name', '.provider-name', '.doctor-name',
            'a[href*="/doctor/"]', 'a[href*="/hospital/"]'
          ];
          
          for (const selector of nameSelectors) {
            try {
              const elements = await card.$$(selector);
              for (const element of elements) {
                const text = await element.textContent();
                if (text && text.trim() && text.length > 2 && text.length < 100) {
                  // Better name validation
                  if ((text.includes('Dr.') || text.includes('MD') || text.includes('DO')) ||
                      (text.includes('Hospital') || text.includes('Medical') || text.includes('Center') ||
                       text.includes('Clinic') || text.includes('Practice') || text.includes('Group') ||
                       text.includes('Associates') || text.includes('Institute') || text.includes('Health')) &&
                      !text.includes('Top Hospitals') && !text.includes('Find') && !text.includes('Search')) {
                    provider.name = text.trim();
                    break;
                  }
                }
              }
              if (provider.name) break;
            } catch (e) {}
          }
          
          // Extract phone - better validation
          const phoneSelectors = [
            '[data-qa-target*="phone"]',
            '.phone', '.telephone',
            'a[href^="tel:"]',
            'span', 'div', 'p'
          ];
          
          for (const selector of phoneSelectors) {
            try {
              const elements = await card.$$(selector);
              for (const element of elements) {
                const text = await element.textContent();
                if (text && text.trim()) {
                  // Better phone pattern matching - exclude invalid numbers
                  const phoneMatch = text.match(/\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}/);
                  if (phoneMatch && !phoneMatch[0].includes('1073741823') && phoneMatch[0].length >= 10) {
                    provider.phone = phoneMatch[0].trim();
                    break;
                  }
                }
              }
              if (provider.phone) break;
            } catch (e) {}
          }
          
          // Extract address - better validation
          const addressSelectors = [
            '[data-qa-target*="address"]',
            '.address', '.location',
            '[data-qa-target*="location"]',
            'span', 'div', 'p'
          ];
          
          for (const selector of addressSelectors) {
            try {
              const elements = await card.$$(selector);
              for (const element of elements) {
                const text = await element.textContent();
                if (text && text.trim() && text.length > 10) {
                  // Better address validation
                  if ((text.includes('LA') || text.includes('Louisiana')) && 
                      (text.includes('St') || text.includes('Ave') || text.includes('Dr') || 
                       text.includes('Rd') || text.includes('Blvd') || text.includes('Ln') ||
                       text.match(/\d{5}/))) { // ZIP code
                    provider.address = text.trim();
                    break;
                  }
                }
              }
              if (provider.address) break;
            } catch (e) {}
          }
          
          // Extract specialty
          const specialtySelectors = [
            '[data-qa-target*="specialty"]',
            '.specialty', '.specialization',
            'span', 'div', 'p'
          ];
          
          for (const selector of specialtySelectors) {
            try {
              const elements = await card.$$(selector);
              for (const element of elements) {
                const text = await element.textContent();
                if (text && text.trim() && 
                    (text.includes('Obstetrics') || text.includes('Gynecology') || 
                     text.includes('OBGYN') || text.includes('Doula') || 
                     text.includes('Midwife') || text.includes('Birth') ||
                     text.includes('Women') || text.includes('Reproductive'))) {
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
          
          // Validate provider data quality
          provider.isValid = (
            provider.name && 
            provider.name.length > 3 && 
            !provider.name.includes('Top Hospitals') &&
            !provider.name.includes('Find') &&
            !provider.name.includes('Search') &&
            (provider.phone || provider.address || provider.url)
          );
          
          // Add if we have valid data
          if (provider.isValid) {
            results.push(provider);
            processedCount++;
            console.log(`✅ Found: ${provider.name} - ${provider.phone || 'No phone'} - ${provider.address || 'No address'}`);
          }
          
        } catch (error) {
          console.error(`Error extracting provider info from card ${i}:`, error.message);
        }
      }
      
      console.log(`📊 Processed ${processedCount} valid providers for ${keyword}`);
      
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
    fs.writeFileSync('optimized_results.json', JSON.stringify(results, null, 2));
    console.log(`✅ Saved ${results.length} results to optimized_results.json`);
    
    // Also log to console
    console.log('\n📊 Results Summary:');
    results.forEach((result, index) => {
      console.log(`${index + 1}. ${result.name} - ${result.phone || 'No phone'} - ${result.address || 'No address'}`);
    });
    
    // Show statistics
    const withPhone = results.filter(r => r.phone).length;
    const withAddress = results.filter(r => r.address).length;
    const withUrl = results.filter(r => r.url).length;
    const withSpecialty = results.filter(r => r.specialty).length;
    const withRating = results.filter(r => r.rating).length;
    
    console.log(`\n📈 Statistics:`);
    console.log(`- Total results: ${results.length}`);
    console.log(`- With phone: ${withPhone}`);
    console.log(`- With address: ${withAddress}`);
    console.log(`- With URL: ${withUrl}`);
    console.log(`- With specialty: ${withSpecialty}`);
    console.log(`- With rating: ${withRating}`);
    
    // Group by keyword
    const byKeyword = {};
    results.forEach(result => {
      if (!byKeyword[result.keyword]) byKeyword[result.keyword] = [];
      byKeyword[result.keyword].push(result);
    });
    
    console.log(`\n📋 Results by keyword:`);
    Object.keys(byKeyword).forEach(keyword => {
      console.log(`- ${keyword}: ${byKeyword[keyword].length} providers`);
    });
    
  } else {
    console.log('❌ No results found');
  }
  
  console.log('🏁 Scraping completed!');
}

optimizedScraper().catch(console.error); 