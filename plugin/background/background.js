let m3u8Links = [];

// Monitor network requests
browser.webRequest.onCompleted.addListener(
  async (details) => {
    if (details.url.endsWith(".m3u8")) {
      const vidUrl = details.url;
      
      // Execute script in the tab to get video name
      let videoName;
      try {
        const ssResults = await browser.tabs.executeScript(details.tabId, {
          code: `
            if (window.location.href.includes('skillshare.com')) {
              document.querySelector('.session-item.active')?.textContent;
            }
          `
        });
        const titleResults = await browser.tabs.executeScript(details.tabId, {
          code: `
            document.title;
          `
        });
        if (ssResults?.[0]) {
          videoName = ssResults?.[0] + ' - ' + titleResults?.[0];
        } else {
          videoName = titleResults?.[0];
        }
      } catch (error) {
        console.error('Error getting video name:', error);
        return;
      }

      if (videoName && !m3u8Links.find(link => link.vidName === videoName)) {
        m3u8Links.push({ vidName: videoName, vidUrl: vidUrl });
        console.log("Found M3U8 link:", details.url, "for video:", videoName);
      }
    }
  },
  { urls: ["<all_urls>"] }
);

// Scan HTML of the active tab
function findM3U8InHTML() {
  browser.tabs.executeScript({
    code: `
      Array.from(document.querySelectorAll("a[href$='.m3u8']")).map(a => a.href)
    `
  }).then((results) => {
    if (results && results[0]) {
      results[0].forEach((url) => m3u8Links.add(url));
      console.log("Found M3U8 links in HTML:", results[0]);
    }
  });
}

// Add listener for the popup to request M3U8 links
browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('Received message:', message);
  if (message.action === "getM3U8Links") {
    sendResponse(Array.from(m3u8Links));
  }
});
