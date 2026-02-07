const iframe = document.getElementById('app-frame');

// Listen for "READ" command from Next.js
window.addEventListener('message', async (event) => {
  // Log receipt for debugging
  console.log("Sidepanel received message:", event.data);

  if (event.data.type === 'REQUEST_READ') {
    console.log("✅ Command recognized: REQUEST_READ. Finding tab...");

    // Get the active tab
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    
    if (tab) {
      console.log("Found tab:", tab.id);
      
      // Send message to content script
      chrome.tabs.sendMessage(tab.id, { action: "get_page_text" }, (response) => {
        // Check for errors (like content script not loaded)
        if (chrome.runtime.lastError) {
          console.error("❌ Error contacting tab:", chrome.runtime.lastError.message);
          return;
        }

        if (response && response.text) {
          console.log("✅ Text received! Length:", response.text.length);
          
          // Send text back down to Next.js iframe
          // We must check if contentWindow exists first
          if (iframe && iframe.contentWindow) {
             iframe.contentWindow.postMessage({ 
                 type: "DECIPHER_TEXT", 
                 text: response.text 
             }, "*");
          }
        } else {
          console.warn("⚠️ Tab returned no text.");
        }
      });
    } else {
      console.error("❌ No active tab found.");
    }
  }
});