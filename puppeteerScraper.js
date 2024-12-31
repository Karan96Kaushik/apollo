const { firefox } = require('playwright');

class M3U8Scraper {
    constructor() {
        this.browser = null;
        this.page = null;
        this.context = null;
    }

    async initialize() {
        try {
            this.browser = await firefox.launch({
                headless: false
            });
            this.context = await this.browser.newContext();
            this.page = await this.context.newPage();

            await this.setupNetworkMonitoring();
        } catch (error) {
            console.error('Initialization error:', error);
            throw error;
        }
    }

    async setupNetworkMonitoring() {
        this.page.on('request', request => {
            const url = request.url();
            if (url.includes('.m3u8')) {
                console.log('Found M3U8 URL in request:', url);
            }
        });

        this.page.on('response', response => {
            const url = response.url();
            if (url.includes('.m3u8')) {
                console.log('Found M3U8 URL in response:', url);
            }
        });
    }

    async navigateToPage(url) {
        try {
            await this.page.goto(url, {
                waitUntil: 'networkidle',
                timeout: 30000
            });
        } catch (error) {
            console.error('Navigation error:', error);
            throw error;
        }
    }

    async findM3U8InNetwork() {
        const m3u8Links = [];
        
        await this.page.route('**/*.m3u8', route => {
            const url = route.request().url();
            m3u8Links.push(url);
            route.continue();
        });

        return m3u8Links;
    }

    async close() {
        if (this.context) {
            await this.context.close();
        }
        if (this.browser) {
            await this.browser.close();
        }
    }
}

async function main() {
    const scraper = new M3U8Scraper();
    try {
        await scraper.initialize();
        await scraper.navigateToPage('https://example.com');
        const m3u8Links = await scraper.findM3U8InNetwork();
        console.log('Found M3U8 links:', m3u8Links);
    } catch (error) {
        console.error('Error:', error);
    } finally {
        await scraper.close();
    }
}

// Uncomment to run:
// main();

module.exports = M3U8Scraper;
