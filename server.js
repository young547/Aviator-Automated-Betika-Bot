'''js
// server.js
const express = require('express');
const puppeteer = require('puppeteer');

const app = express();
const PORT = process.env.PORT || 3000;

let gameRounds = [];

async function scrapeGameData() {
  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });
  const page = await browser.newPage();
  await page.goto('https://betika.com/spribe/aviator');
  await page.waitForSelector('.c-status__text');

  page.exposeFunction('onRoundUpdate', (multiplier) => {
    console.log('New multiplier:', multiplier);
    gameRounds.push({ timestamp: Date.now(), multiplier });
    if (gameRounds.length > 100) gameRounds.shift();
  });

  await page.evaluate(() => {
    const targetNode = document.querySelector('.c-status__text');
    if (!targetNode) return;

    const observer = new MutationObserver(mutations => {
      mutations.forEach(mutation => {
        if (mutation.type === 'childList') {
          const text = mutation.target.textContent;
          const m = text.match(/x(\d+\.\d+)/);
          if (m && m) {
            window.onRoundUpdate(parseFloat(m));
          }
        }
      });
    });

    observer.observe(targetNode, { childList: true });
  });

  console.log('Scraper running...');
}

function predictNext() {
  if (!gameRounds.length) return 1;
  const lastFive = gameRounds.slice(-5).map(r => r.multiplier);
  return lastFive.reduce((a, b) => a + b, 0) / lastFive.length;
}

app.get('/predict', (req, res) => {
  const prediction = predictNext();
  res.json({ predictedMultiplier: prediction });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  scrapeGameData();
});
```

Also create or update `package.json` to include:

```json
{
  "name": "aviator-predictor",
  "version": "1.0.0",
  "main": "server.js",
  "scripts": {
    "start": "node server.js"
  },
  "dependencies": {
    "express": "^4.18.2",
    "puppeteer": "^20.8.1"
  }
}
