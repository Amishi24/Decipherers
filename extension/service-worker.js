// Allows users to open the side panel by clicking the action toolbar icon
chrome.sidePanel
  .setPanelBehavior({ openPanelOnActionClick: true })
  .catch((error) => console.error(error));

// Optional: Context menu to "Read with Decipher"
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: 'decipher-read',
    title: 'Read selection with Decipher.IO',
    contexts: ['selection']
  });
});