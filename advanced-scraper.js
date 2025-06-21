import { chromium } from 'playwright';
import fs from 'fs';

async function advancedScraper() {
  console.log('🚀 Starting advanced Healthgrades scraper with pagination and profile phone extraction...');
  
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
  const maxPages = 10; // Limit to avoid infinite loops
  
  for (const keyword of keywords) {
    console.log(`🔍 Scraping for: ${keyword}`);
    let pageNum = 1;
    let hasNextPage = true;
    let seenNames = new Set();
    while (hasNextPage && pageNum <= maxPages) {
      const url = `https://www.healthgrades.com/usearch?what=${encodeURIComponent(keyword)}&where=Louisiana&page=${pageNum}`;
      await page.goto(url, { 
        waitUntil: 'networkidle',
        timeout: 60000 
      });
      console.log(`📄 Loaded page: ${url}`);
      await page.waitForTimeout(3000);
      for (let i = 0; i < 3; i++) {
        await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
        await page.waitForTimeout(1500);
      }
      try {
        await page.waitForSelector('[data-qa-target="loading"], .loading, .spinner', { 
          state: 'hidden',
          timeout: 10000 
        });
      } catch (e) {
        console.log('No loading indicator found or already loaded');
      }
      const cards = await page.$$('[data-qa-target^="pro-card-natural-"]');
      if (cards.length === 0) {
        console.log('No provider cards found on this page.');
        break;
      }
      console.log(`Processing ${cards.length} cards on page ${pageNum}...`);
      for (let i = 0; i < cards.length; i++) {
        const card = cards[i];
        try {
          const provider = {
            keyword,
            name: '',
            phone: '',
            address: '',
            specialty: '',
            rating: '',
            reviewCount: '',
            url: ''
          };
          // Name & Profile URL
          try {
            const nameLink = await card.$('[data-qa-target="provider-name"] a[data-qa-target="name-link"]');
            if (nameLink) {
              provider.name = (await nameLink.textContent())?.trim() || '';
              provider.url = await nameLink.getAttribute('href') || '';
              if (provider.url && !provider.url.startsWith('http')) {
                provider.url = `https://www.healthgrades.com${provider.url}`;
              }
            }
          } catch (e) {}
          // Specialty
          try {
            provider.specialty = await card.$eval('[data-qa-target="provider-specialty"]', el => el.textContent.trim());
          } catch (e) {}
          // Rating
          try {
            provider.rating = await card.$eval('[data-qa-target="provider-rating-score"]', el => el.textContent.trim());
          } catch (e) {}
          // Review Count
          try {
            provider.reviewCount = await card.$eval('[data-qa-target="provider-rating-count"]', el => el.textContent.trim());
          } catch (e) {}
          // Address
          try {
            provider.address = await card.$eval('[data-qa-target="location-info-address"]', el => el.textContent.replace(/\s+/g, ' ').trim());
          } catch (e) {}
          // Phone (if present in card)
          try {
            provider.phone = await card.$eval('[data-qa-target="sponsor-phone-link"]', el => el.textContent.trim());
          } catch (e) {}
          // Only add if we have a name and at least one other field
          if (
            provider.name &&
            !seenNames.has(provider.name) &&
            (provider.phone || provider.address || provider.url)
          ) {
            // If phone is missing, visit profile page to extract it
            if (!provider.phone && provider.url) {
              try {
                const profilePage = await context.newPage();
                await profilePage.goto(provider.url, { waitUntil: 'domcontentloaded', timeout: 30000 });
                await profilePage.waitForTimeout(2000);
                // Try several selectors for phone on profile page
                const phoneSelectors = [
                  '[data-qa-target="provider-phone"]',
                  '.provider-phone',
                  'a[href^="tel:"]',
                  '.phone',
                  '[data-testid="phone"]'
                ];
                for (const selector of phoneSelectors) {
                  try {
                    const phone = await profilePage.$eval(selector, el => el.textContent.trim());
                    if (phone && phone.match(/\d{3}/)) {
                      provider.phone = phone;
                      break;
                    }
                  } catch (e) {}
                }
                await profilePage.close();
              } catch (e) {
                console.log(`Could not extract phone from profile for ${provider.name}`);
              }
              // Be polite
              await page.waitForTimeout(500);
            }
            seenNames.add(provider.name);
            results.push(provider);
            console.log(`✅ Found: ${provider.name} - ${provider.phone || 'No phone'} - ${provider.address || 'No address'}`);
          }
        } catch (error) {
          console.error(`Error extracting provider info from card ${i}:`, error.message);
        }
      }
      // Check for next page
      try {
        const nextBtn = await page.$('[data-qa-target="pagination-next"]:not([disabled]), .pagination-next:not([disabled])');
        if (nextBtn) {
          hasNextPage = true;
          pageNum++;
          await page.waitForTimeout(2000);
        } else {
          hasNextPage = false;
        }
      } catch (e) {
        hasNextPage = false;
      }
    }
    // Screenshot for each keyword
    await page.screenshot({ path: `debug-${keyword}.png`, fullPage: true });
    console.log(`📸 Screenshot saved as debug-${keyword}.png`);
    await page.waitForTimeout(3000);
  }
  await browser.close();
  // Save results
  if (results.length > 0) {
    fs.writeFileSync('advanced_results.json', JSON.stringify(results, null, 2));
    console.log(`✅ Saved ${results.length} results to advanced_results.json`);
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

advancedScraper().catch(console.error); 