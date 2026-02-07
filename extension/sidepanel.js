const iframe = document.getElementById('app-frame');

window.addEventListener('message', async (event) => {
  if (event.data.type === 'REQUEST_READ') {
    // Get the active tab
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    
    if (tab) {
      // Send message to content script
      chrome.tabs.sendMessage(tab.id, { action: "get_page_text" }, (response) => {
        // If content script sends text back...
        if (response && response.text) {
          // Send it down to the Next.js app
          if (iframe && iframe.contentWindow) {
             iframe.contentWindow.postMessage({ 
                 type: "DECIPHER_TEXT", 
                 text: response.text 
             }, "*");
          }
        }
      });
    }
  }
});