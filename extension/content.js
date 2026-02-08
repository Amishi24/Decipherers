console.log("Decipher Content Script Loaded!"); // This proves the script is running

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    console.log("Content Script received request:", request);

    if (request.action === "get_page_text") {
      const text = getVisibleText();
      console.log("Scraped text length:", text.length);
      sendResponse({ 
          text: text,
          title: document.title || "Untitled Page",
          url: window.location.hostname // Just the domain is cleaner
      });
    }
    return true; 
});

// ... keep your getVisibleText function below ...

// Listen for messages from the Side Panel
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "get_page_text") {
      const text = getVisibleText();
      sendResponse({ text: text });
    }
    return true; // Keep the message channel open for async response
});

// Simple scraper function (We can make this smarter later)
function getVisibleText() {
    // 1. Try to find the main article body
    const article = document.querySelector('article') || document.querySelector('main') || document.body;
    
    // 2. Grab all paragraphs
    const paragraphs = Array.from(article.querySelectorAll('p, h1, h2, h3, li'))
        .filter(el => {
            // Filter out hidden elements or tiny text
            return el.offsetParent !== null && el.innerText.length > 30;
        })
        .map(el => el.innerText.trim())
        .join('\n\n');

    return paragraphs || "Could not find readable text on this page.";
}