
import express from 'express';
import puppeteer from 'puppeteer';
import readline from 'readline';

const app = express();
const PORT = process.env.PORT || 3000;

let gameRounds = [];
let roundEnded = false;

async function scrapeGameData() {
  try {
    const browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });
    const page = await browser.newPage();

    await page.goto('https://www.betika.com/en-ke/aviator', {
      waitUntil: 'networkidle2',
      timeout: 60000,
    });

    await page.waitForSelector('div.status > span.status-text', { timeout: 60000 });

    page.exposeFunction('onRoundUpdate', multiplier => {
      console.log(`New multiplier: ${multiplier}`);
      gameRounds.push({ timestamp: Date.now(), multiplier });
      if (gameRounds.length > 100) gameRounds.shift();
    });

    page.exposeFunction('onRoundEnd', () => {
      roundEnded = true;
      console.log('Round ended!');
    });

    await page.evaluate(() => {
      const statusNode = document.querySelector('div.status > span.status-text');
      if (!statusNode) return;

      let lastMultiplier = null;

      const observer = new MutationObserver(mutations => {
        mutations.forEach(mutation => {
          if (mutation.type === 'childList') {
            const text = mutation.target.textContent;
            const match = text.match(/x(\d+(\.\d+)?)/);

            if (match) {
              const multiplier = parseFloat(match);
              window.onRoundUpdate(multiplier);
              lastMultiplier = multiplier;
            } else if (lastMultiplier!== null) {
              window.onRoundEnd();
              lastMultiplier = null;
            }
          }
        });
      });

      observer.observe(statusNode, { childList: true });
    });

    console.log('Scraper running...');
  } catch (err) {
    console.error('Scraper error:', err);
  }
}

function predictNext() {
  if (gameRounds.length === 0) return null;
  const lastFive = gameRounds.slice(-5).map(r => r.multiplier);
  const avg = lastFive.reduce((a, b) => a + b, 0) / lastFive.length;
  return avg;
}

function startBot() {
  console.log('Starting Aviator bot...');
  // Add your bot logic here if needed
}

function askStrategy() {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  rl.question('Select strategy (1-4): ', (answer) => {
    if (['1','2','3','4'].includes(answer)) {
      startBot(answer);
    } else {
      console.log('Invalid choice. Exiting.');
      process.exit(1);
    }
    rl.close();
  });
}

app.get('/predict', (req, res) => {
  if (!roundEnded) return res.json({ status: 'round_in_progress', message: 'Waiting for round to end...' });
  roundEnded = false;
  const prediction = predictNext();
  res.json({ status: 'ready', prediction });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  scrapeGameData();

  if (process.env.STRATEGY && ['1','2','3','4'].includes(process.env.STRATEGY)) {
    startBot(process.env.STRATEGY);
  } else {
    askStrategy();
  }
});
