document.addEventListener("DOMContentLoaded", () => {
    const linkList = document.getElementById("link-list");
  
    // Request M3U8 links from the background script
    browser.runtime.sendMessage({ action: "getM3U8Links" }).then((links) => {
      if (links.length > 0) {
        links.forEach((link) => {
          const listItem = document.createElement("li");
          const container = document.createElement("div");
          container.className = "link-container";

          const linkElement = document.createElement("a");
          linkElement.href = link.vidUrl;
          linkElement.textContent = link.vidName;
          linkElement.target = "_blank";

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

          container.appendChild(linkElement);
          container.appendChild(sendIcon);
          listItem.appendChild(container);
          linkList.appendChild(listItem);
        });
      } else {
        linkList.textContent = "No M3U8 links found.";
      }
    });
  });