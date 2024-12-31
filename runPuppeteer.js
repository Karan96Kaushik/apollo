// const puppeteer = require('puppeteer');
const M3U8Scraper = require('./puppeteerScraper');

const scraper = new M3U8Scraper();

async function run() {
    await scraper.initialize();
    await scraper.navigateToPage('https://www.skillshare.com/en/classes/how-to-draw-a-beginners-guide-part-1-of-the-drawing-laboratory/1607370408/projects?via=member-home-EnrolledClassesLessonsSection');
}

run();