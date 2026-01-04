
const geminiService = require("./src/services/gemini.service");

async function test() {
    console.log("Testing Fahrenheit 451 - A Adaptação Autorizada...");
    try {
        const info = await geminiService.fetchBookBasicInfo("9788580448005");
        console.log("TITLE:", info.title);
        console.log("YEAR (publishDate):", info.publishDate);
        console.log("COVER:", info.coverUrl);
        console.log("SYNOPSIS START:", info.synopsis.substring(0, 100));
        console.log("HAS NEWLINES:", info.synopsis.includes('\n'));
    } catch (err) {
        console.error(err);
    }
}

test();
