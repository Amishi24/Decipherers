// list-models.js
const https = require('https');

// --- PASTE YOUR API KEY HERE ---
const API_KEY = "AIzaSyB3K9Czw6KsFujv5Mp4DTYtCM5cou5LwOc"; 
// -------------------------------

const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${API_KEY}`;

https.get(url, (res) => {
  let data = '';

  res.on('data', (chunk) => {
    data += chunk;
  });

  res.on('end', () => {
    try {
      const json = JSON.parse(data);
      if (json.error) {
        console.error("Error:", json.error.message);
      } else if (json.models) {
        console.log("\n✅ SUCCESS! Here are the models you can use:\n");
        json.models.forEach(model => {
            // We only care about models that support "generateContent"
            if(model.supportedGenerationMethods && model.supportedGenerationMethods.includes("generateContent")) {
                console.log(`Name: ${model.name}`);
                console.log(`      (Use this string in your code: "${model.name.replace('models/', '')}")`);
                console.log("---------------------------------------------------");
            }
        });
      } else {
        console.log("Unexpected response:", json);
      }
    } catch (e) {
      console.error("Failed to parse response:", e.message);
    }
  });

}).on("error", (err) => {
  console.error("Network Error:", err.message);
});