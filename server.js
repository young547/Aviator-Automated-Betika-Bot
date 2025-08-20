
```js
const express = require('express');
const puppeteer = require('puppeteer');

const app = express();
const PORT = process.env.PORT || 3000;

let gameRounds = [];
let roundEnded = false;

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

  page.exposeFunction('onRoundEnd', () => {
    roundEnded = true;
    console.log('Round ended!');
  });

  await page.evaluate(() => {
    const statusNode = document.querySelector('.c-status__text');
    if (!statusNode) return;

    let lastMultiplier = null;

    const observer = new MutationObserver(mutations => {
      mutations.forEach(mutation => {
        if (mutation.type === 'childList') {
          const text = mutation.target.textContent;
          const m = text.match(/x(\d+\.\d+)/);

          if (m && m) {
            const multiplier = parseFloat(m);
            window.onRoundUpdate(multiplier);
            lastMultiplier = multiplier;
          } else {
            if (lastMultiplier!== null) {
              window.onRoundEnd();
              lastMultiplier = null;
            }
          }
        }
      });
    });

    observer.observe(statusNode, { childList: true });
  });

  console.log('Scraper running...');
}

function predictNext() {
  if (!gameRounds.length) return 1;
  const lastFive = gameRounds.slice(-5).map(r => r.multiplier);
  return lastFive.reduce((a, b) => a + b, 0) / lastFive.length;
}

app.get('/predict', (req, res) => {
  if (!roundEnded) {
    return res.json({ status: "round_in_progress", message: "Waiting for round to end..." });
  }
  roundEnded = false; // Reset for next round
  const prediction = predictNext();
  res.json({ status: "ready", predictedMultiplier: prediction });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  scrapeGameData();
});
