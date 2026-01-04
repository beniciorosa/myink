const fs = require('fs');
const content = fs.readFileSync('.env', 'utf8');
const line = content.split('\n').find(l => l.startsWith('GEMINI_API_KEY='));
if (line) {
    const key = line.split('=')[1].trim();
    console.log('Key:', key);
    console.log('Length:', key.length);
    for (let i = 0; i < key.length; i++) {
        console.log(`Char ${i}: ${key[i]} (${key.charCodeAt(i)})`);
    }
} else {
    console.log('Key not found');
}
