const iframe = document.getElementById('app-frame');

// --- Helper: Inject Script and Retry ---
async function injectAndRead(tabId) {
  try {
    console.log(`💉 Injecting content script into tab ${tabId}...`);
    
    // Manually inject the content script
    await chrome.scripting.executeScript({
      target: { tabId: tabId },
      files: ['content.js']
    });

    console.log("✅ Injection successful. Retrying message...");
    
    // Short timeout to ensure script is initialized
    setTimeout(() => {
        sendMessageToTab(tabId, false); // false = don't retry again to avoid loops
    }, 100);
    
  } catch (err) {
    console.error("❌ Failed to inject script (Page might be restricted):", err);
  }
}

// --- Helper: Send Message ---
function sendMessageToTab(tabId, allowRetry = true) {
  chrome.tabs.sendMessage(tabId, { action: "get_page_text" }, (response) => {
    
    // 1. Handle Errors (Content script not ready)
    if (chrome.runtime.lastError) {
      const errorMsg = chrome.runtime.lastError.message;
      console.warn(`⚠️ Attempt failed: ${errorMsg}`);

      // If the error is "Receiving end does not exist", it means content.js isn't there.
      // We inject it manually.
      if (allowRetry && errorMsg.includes("Receiving end does not exist")) {
        injectAndRead(tabId);
      }
      return;
    }

    // 2. Handle Success
    if (response && response.text) {
      console.log("✅ Text received! Length:", response.text.length);
      
      // Pass data to the Next.js app in the iframe
      if (iframe && iframe.contentWindow) {
         iframe.contentWindow.postMessage({ 
             type: "DECIPHER_TEXT", 
             text: response.text,
             title: response.title,
             url: response.url
         }, "*");
      }
    }
  });
}

// --- Main Listener ---
window.addEventListener('message', async (event) => {
  if (event.data.type === 'REQUEST_READ') {
    
    // Get the active tab
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    
    if (tab && tab.id) {
        // SAFETY CHECK: Prevent crashing if tab.url is undefined
        // We only check startsWith if tab.url actually exists
        if (tab.url && (tab.url.startsWith("chrome://") || tab.url.startsWith("edge://") || tab.url.startsWith("about:"))) {
            console.error("❌ Cannot read browser system pages.");
            return;
        }

        console.log(`Requesting read for Tab ID: ${tab.id}`);
        sendMessageToTab(tab.id);
    } else {
        console.error("❌ No active tab found.");
    }
  }
});