// extension/background.js

// 1. Create the context menu option when the extension initializes
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "sendToBambi",
    title: "Send to Bambi",
    contexts: ["selection"] // Only shows up when text is highlighted
  });
});

// 2. Listen for the click event on our custom menu item
chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === "sendToBambi" && info.selectionText) {
    const highlightedText = info.selectionText;

    // Send the payload to your local FastAPI server
    fetch("http://127.0.0.1:8000/snippets/save", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ content: highlightedText })
    })
    .then(response => response.json())
    .then(data => {
      console.log("Success:", data);
      // Optional: Visual confirmation could be integrated here later
    })
    .catch((error) => {
      console.error("Error sending text to Bambi:", error);
    });
  }
});