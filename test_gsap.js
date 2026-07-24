const puppeteer = require('puppeteer');
(async () => {
  const browser = await puppeteer.launch({headless: "new"});
  const page = await browser.newPage();
  page.on('console', msg => console.log('PAGE LOG:', msg.text()));
  page.on('pageerror', err => console.log('PAGE ERROR:', err.toString()));
  await page.goto('http://localhost:3000', {waitUntil: 'networkidle0'});
  await page.screenshot({path: 'screenshot_before.png'});
  await new Promise(r => setTimeout(r, 2000));
  await page.screenshot({path: 'screenshot_after.png'});
  await browser.close();
})();
