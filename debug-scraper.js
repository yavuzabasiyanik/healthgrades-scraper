import { chromium } from 'playwright';
import fs from 'fs';

async function debugScraper() {
  console.log('🔍 Starting debug scraper...');
  
  const browser = await chromium.launch({ 
    headless: false, // Run in visible mode for debugging
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
  });
  
  const page = await context.newPage();
  
  try {
    console.log('🌐 Navigating to Healthgrades...');
    
    // First, let's try the main site
    await page.goto('https://www.healthgrades.com', { 
      waitUntil: 'domcontentloaded',
      timeout: 60000 
    });
    
    console.log('✅ Main page loaded');
    await page.waitForTimeout(3000);
    
    // Now try the search
    const searchUrl = 'https://www.healthgrades.com/usearch?what=obgyn&where=Louisiana';
    console.log(`🔍 Navigating to search: ${searchUrl}`);
    
    await page.goto(searchUrl, { 
      waitUntil: 'domcontentloaded',
      timeout: 60000 
    });
    
    console.log('✅ Search page loaded');
    await page.waitForTimeout(5000);
    
    // Take a screenshot for debugging
    await page.screenshot({ path: 'debug-screenshot.png', fullPage: true });
    console.log('📸 Screenshot saved as debug-screenshot.png');
    
    // Get page title and URL
    const title = await page.title();
    const url = page.url();
    console.log(`📄 Page title: ${title}`);
    console.log(`🔗 Current URL: ${url}`);
    
    // Check if we got redirected or blocked
    if (url.includes('captcha') || url.includes('blocked') || url.includes('access-denied')) {
      console.log('❌ Page appears to be blocked or showing captcha');
      return;
    }
    
    // Try to find any content on the page
    const bodyText = await page.evaluate(() => document.body.innerText);
    console.log(`📝 Page has ${bodyText.length} characters of text`);
    
    // Look for common elements
    const selectors = [
      '[data-qa-target="provider-result-card"]',
      '.provider-card',
      '.search-result',
      '.provider-result',
      '[data-testid="provider-card"]',
      '.doctor-card',
      '.hospital-card',
      '.search-results',
      '.results',
      'article',
      '.card',
      '.listing'
    ];
    
    console.log('🔍 Checking for provider cards...');
    for (const selector of selectors) {
      try {
        const elements = await page.$$(selector);
        if (elements.length > 0) {
          console.log(`✅ Found ${elements.length} elements with selector: ${selector}`);
          
          // Try to extract some basic info from the first element
          const firstElement = elements[0];
          const text = await firstElement.evaluate(el => el.textContent);
          console.log(`📝 First element text (first 200 chars): ${text.substring(0, 200)}...`);
          
          // Look for links
          const links = await firstElement.$$('a');
          console.log(`🔗 Found ${links.length} links in first element`);
          
          for (let i = 0; i < Math.min(links.length, 3); i++) {
            const href = await links[i].getAttribute('href');
            const linkText = await links[i].textContent();
            console.log(`  Link ${i + 1}: ${linkText} -> ${href}`);
          }
        } else {
          console.log(`❌ No elements found with selector: ${selector}`);
        }
      } catch (error) {
        console.log(`⚠️ Error checking selector ${selector}: ${error.message}`);
      }
    }
    
    // Save page HTML for inspection
    const html = await page.content();
    fs.writeFileSync('debug-page.html', html);
    console.log('💾 Page HTML saved as debug-page.html');
    
    // Wait for user to see the page
    console.log('⏳ Waiting 10 seconds for manual inspection...');
    await page.waitForTimeout(10000);
    
  } catch (error) {
    console.error('❌ Error during debugging:', error.message);
  } finally {
    await browser.close();
    console.log('🔒 Browser closed');
  }
}

debugScraper().catch(console.error); 