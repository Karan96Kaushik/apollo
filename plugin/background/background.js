let videoLinks = [];

// Monitor network requests
browser.webRequest.onCompleted.addListener(
  async (details) => {
    if (details.url.includes(".m3u8") || details.url.endsWith(".mp4")) {
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
        // if (videoName.includes('Apollo Player')) {
        //   return;
        // }
        videoName = videoName.trim().split(' ').filter(Boolean).map(word => word.trim()).join(' ');
        videoName = videoName.split(' ').filter(Boolean).join(' ');
        videoName = videoName.split('\n').filter(Boolean).join(' ');
        videoName = videoName.replace(/\//g, '|');

      } catch (error) {
        console.error('Error getting video name:', error);
        return;
      }

      if (videoName && !videoLinks.find(link => link.vidName === videoName)) {
        videoLinks.unshift({ 
          vidName: videoName, 
          vidUrl: vidUrl,
          timestamp: +new Date() 
        });
        console.log("Found video link:", details.url, "for video:", videoName);
      }
    }
  },
  { urls: ["<all_urls>"] }
);

// Scan HTML of the active tab
function findVideoLinksInHTML() {
  browser.tabs.executeScript({
    code: `
      // Get direct video links from <a> tags
      const linkUrls = Array.from(document.querySelectorAll("a[href$='.m3u8'], a[href$='.mp4']"))
        .map(a => a.href);
      
      // Get video sources from <video> elements
      const videoSources = Array.from(document.querySelectorAll('video'))
        .flatMap(video => {
          // Get src attribute if present
          const directSrc = video.src ? [video.src] : [];
          // Get sources from <source> elements
          const sourceTags = Array.from(video.querySelectorAll('source'))
            .map(source => source.src)
            .filter(src => src.endsWith('.m3u8') || src.endsWith('.mp4'));
          
          return [...directSrc, ...sourceTags];
        })
        .filter(url => url); // Remove empty strings

      // Combine and return all unique URLs
      [...new Set([...linkUrls, ...videoSources])]
    `
  }).then((results) => {
    if (results && results[0]) {
      results[0].forEach((url) => {
        if (!videoLinks.find(link => link.vidUrl === url)) {
          videoLinks.push({ 
            vidName: url, 
            vidUrl: url,
            timestamp: +new Date()
          });
        }
      });
      console.log("Found video links in HTML:", results[0]);
    }
  });
}

// Add listener for the popup to request M3U8 links
browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('Received message:', message);
  if (message.action === "getM3U8Links") {
    sendResponse(Array.from(videoLinks));
  } else if (message.action === "resetLinks") {
    videoLinks = [];
    sendResponse(true);
  }
});
