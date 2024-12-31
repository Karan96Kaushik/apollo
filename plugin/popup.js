document.addEventListener("DOMContentLoaded", () => {
    const linkList = document.getElementById("link-list");
  
    // Add reset button handler
    document.getElementById("resetLinks").addEventListener("click", async () => {
        await browser.runtime.sendMessage({ action: "resetLinks" });
        linkList.innerHTML = ""; // Clear the current list
        linkList.textContent = "No M3U8 links found.";
    });
  
    // Request M3U8 links from the background script
    browser.runtime.sendMessage({ action: "getM3U8Links" }).then((links) => {
      if (links.length > 0) {
        links.forEach((link) => {
          const listItem = document.createElement("li");
          listItem.setAttribute('alt', link.vidName);
          listItem.setAttribute('title', link.vidName);
          const container = document.createElement("div");
          container.className = "link-container";

          const linkElement = document.createElement("a");
          linkElement.href = link.vidUrl;
          linkElement.textContent = link.vidName;
          linkElement.target = "_blank";
          linkElement.style.overflow = "hidden";
          linkElement.style.textOverflow = "ellipsis";
          linkElement.style.whiteSpace = "nowrap";

          const timestampBadge = document.createElement("span");
          timestampBadge.className = "timestamp-badge";
          const time = new Date(link.timestamp);
          timestampBadge.textContent = time.toLocaleTimeString('default', { 
            hour: '2-digit', 
            minute: '2-digit',
            hour12: false 
          });

          const actionIcons = document.createElement("div");
          actionIcons.className = "action-icons";

          const playIcon = document.createElement("div");
          playIcon.className = "play-icon material-icons";
          playIcon.textContent = "play_arrow";
          playIcon.addEventListener("click", () => {
            chrome.tabs.create({
              url: `player.html?url=${encodeURIComponent(link.vidUrl)}`
            });
          });

          const sendIcon = document.createElement("span");
          sendIcon.innerHTML = '<span class="material-icons">send</span>';
          sendIcon.className = "send-icon";
          sendIcon.title = "Send to server";
          sendIcon.onclick = async () => {
            try {
              const response = await fetch('http://localhost:3000/download/browser', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                  name: link.vidName,
                  url: link.vidUrl
                })
              });
              if (!response.ok) throw new Error('Network response was not ok');
              sendIcon.innerHTML = '<span class="material-icons">check_circle</span>';
              setTimeout(() => { sendIcon.innerHTML = '<span class="material-icons">send</span>'; }, 2000);
            } catch (error) {
              console.error('Error:', error);
              sendIcon.innerHTML = '<span class="material-icons">error</span>';
              setTimeout(() => { sendIcon.innerHTML = '<span class="material-icons">send</span>'; }, 2000);
            }
          };

          actionIcons.appendChild(playIcon);
          actionIcons.appendChild(sendIcon);

          container.appendChild(linkElement);
          container.appendChild(timestampBadge);
          container.appendChild(actionIcons);
          listItem.appendChild(container);
          linkList.appendChild(listItem);
        });
      } else {
        linkList.textContent = "No M3U8 links found.";
      }
    });
  });