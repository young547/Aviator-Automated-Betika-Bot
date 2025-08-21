
import express from 'express';
import puppeteer from 'puppeteer';

const app = express();
const PORT = process.env.PORT || 3000;
let gameRounds = [];

async function scrapeGameData() {
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  const page = await browser.newPage();

  try {
    await page.goto('https://www.betika.com/en-ke/aviator', {
      waitUntil: 'domcontentloaded',
      timeout: 60000
    });

    const selector = '.c-multiplier'; // Replace with the actual selector

    const elementHandle = await page.waitForSelector(selector, { timeout: 10000 }).catch(() => null);

    if (elementHandle) {
      page.exposeFunction('onRoundUpdate', (multiplier) => {
        console.log('New multiplier:', multiplier);
        gameRounds.push({ timestamp: Date.now(), multiplier });
        if (gameRounds.length > 100) gameRounds.shift();
      });

      await page.evaluate((selector) => {
        const targetNode = document.querySelector(selector);
        if (!targetNode) return;

        const observer = new MutationObserver(mutations => {
          mutations.forEach(mutation => {
            const text = mutation.target.textContent;
            const match = text.match(/x(\d+(\.\d+)?)/);
            if (match && match[1]) {
              window.onRoundUpdate(parseFloat(match[1]));
            }
          });
        });

        observer.observe(targetNode, { childList: true, subtree: true });
      }, selector);

      console.log('🔍 Scraping multipliers from Betika Aviator...');
    } else {
      console.warn(`⚠️ Selector "${selector}" not found. Skipping scraping.`);
    }
  } catch (error) {
    console.error('Error during scraping:', error.message);
  }
}

function predictNext() {
  if (gameRounds.length < 5) return 1.00;
  const lastFive = gameRounds.slice(-5).map(r => r.multiplier);
  const avg = lastFive.reduce((a, b) => a + b, 0) / lastFive.length;
  return avg.toFixed(2);
}

app.get('/predict', (req, res) => {
  res.json({ predictedMultiplier: predictNext() });
});
console.log(`✅ Server running on http://localhost:{PORT}`);
  scrapeGameData();
});
