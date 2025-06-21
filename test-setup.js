import { chromium } from 'playwright';

async function testSetup() {
  console.log('🧪 Testing Playwright setup...');
  
  try {
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    
    console.log('✅ Browser launched successfully');
    
    await page.goto('https://www.google.com');
    const title = await page.title();
    console.log(`✅ Page loaded successfully. Title: ${title}`);
    
    await browser.close();
    console.log('✅ Browser closed successfully');
    console.log('🎉 Playwright setup is working correctly!');
    
  } catch (error) {
    console.error('❌ Setup test failed:', error.message);
    console.log('💡 Try running: npx playwright install chromium');
  }
}

testSetup(); 