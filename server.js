
import express from 'express';
import puppeteer from 'puppeteer';

const app = express();
const PORT = process.env.PORT || 3000;
let gameRounds = [];

async function scrapeGameData() {
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });
  const page = await browser.newPage();

  await page.goto('https://www.betika.com/en-ke/aviator', {
    waitUntil: 'networkidle2',
    timeout: 60000,
  });

  const multiplierSelector = 'div[class*="multiplier"]';

  await page.waitForSelector(multiplierSelector, { timeout: 10000 });

  await page.exposeFunction('onRoundUpdate', (multiplier) => {
    console.log('Multiplier updated:', multiplier);
    gameRounds.push({ timestamp: Date.now(), multiplier });
    if (gameRounds.length > 100) gameRounds.shift();
  });

  await page.evaluate((selector) => {
    const el = document.querySelector(selector);
    if (!el) return;

    const observer = new MutationObserver((mutations) => {
      mutations.forEach((m) => {
        const text = m.target.textContent;
        const match = text.match(/(\d+(\.\d+)?)x/);
        if (match && match) {
          window.onRoundUpdate(parseFloat(match));
        }
      });
    });

    observer.observe(el, { childList: true, subtree: true });
  }, multiplierSelector);

  // Check for Provably Fair popup every 5 seconds for RNG data
  setInterval(async () => {
    try {
      const modalSelector = '.modal-content';
      await page.waitForSelector(modalSelector, { timeout: 3000 });

      const popupData = await page.evaluate(() => {
        const modal = document.querySelector('.modal-content');
        if (!modal) return null;
        const getValueByLabel = (label) => {
          const labelEl = [...modal.querySelectorAll('div')].find(div =>
            div.textContent.includes(label)
          );
          return labelEl?.nextElementSibling?.textContent.trim() || null;
        };
        return {
          round: getValueByLabel('ROUND'),
          multiplier: modal.querySelector('span.purple')?.textContent.trim() || null,
          serverSeed: getValueByLabel('Server Seed'),
          clientSeed: getValueByLabel('Client Seed'),
          combinedHash: getValueByLabel('Combined SHA512 Hash'),
          hex: getValueByLabel('Hex'),
          decimal: getValueByLabel('Decimal'),
          result: getValueByLabel('Result'),
        };
      });
      if (popupData) console.log('Provably Fair RNG data:', popupData);
    } catch {
      // Popup not open or no data, ignore silently
    }
  }, 5000);

  console.log('🛫 Scraping Betika Aviator multipliers and RNG...');
}

function predictNext() {
  if (gameRounds.length < 5) return 1.0;
  const lastFive = gameRounds.slice(-5).map(r => r.multiplier);
  const avg = lastFive.reduce((a, b) => a + b, 0) / lastFive.length;
  return avg.toFixed(2);
}

app.get('/predict', (req, res) => {
  res.json({ predictedMultiplier: predictNext() });
});

app.listen(PORT, () => console.log(`✅ Server running http://localhost:${PORT}`));

scrapeGameData();
