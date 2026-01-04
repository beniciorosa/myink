const { OpenAI } = require("openai");
const fs = require('fs');
require("dotenv").config({ override: true });

function debugLog(msg) {
    const timestamp = new Date().toISOString();
    const line = `[${timestamp}] [OPENAI] ${msg}`;
    console.log(line);
}

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
});

/**
 * Transforms a discovery query into structured search parameters.
 */
const classifyDiscoveryQuery = async (query) => {
    try {
        const response = await openai.chat.completions.create({
            model: "gpt-4o-mini",
            messages: [
                {
                    role: "system",
                    content: `Você é um bibliotecário especialista em descoberta de livros. 
          Transforme o pedido do usuário em critérios de busca técnicos.
          Responda sempre em JSON.`
                },
                {
                    role: "user",
                    content: `Analise: "${query}". 
          Extraia: gênero, tema (keywords), tamanho (curto/médio/longo), período, idioma, e exclusões.
          Sugira também 5 títulos de livros famosos que se encaixam perfeitamente.`
                }
            ],
            response_format: { type: "json_object" }
        });

        const result = JSON.parse(response.choices[0].message.content);
        debugLog(`Descoberta OpenAI: ${JSON.stringify(result)}`);
        return result;
    } catch (err) {
        debugLog(`Erro classifyDiscoveryQuery: ${err.message}`);
        return null;
    }
};

/**
 * Re-ranks results and adds a whyExplanation for each book.
 */
const rankAndExplain = async (query, books) => {
    try {
        if (!books || books.length === 0) return [];

        const bookList = books.map(b => `${b.title} (${b.author})`).join('\n');

        const response = await openai.chat.completions.create({
            model: "gpt-4o-mini",
            messages: [
                {
                    role: "system",
                    content: `Você é um guia literário. O usuário buscou: "${query}".
          Abaixo estão os resultados encontrados. 
          Sua tarefa é:
          1. Re-rankear os livros por relevância ao pedido.
          2. Criar uma "whyExplanation" curta (máx 15 palavras) para cada um justificando a recomendação.
          Retorne JSON: { "ranked": [ { "title": "...", "whyExplanation": "..." }, ... ] }`
                },
                {
                    role: "user",
                    content: `Livros encontrados:\n${bookList}`
                }
            ],
            response_format: { type: "json_object" }
        });

        const aiResult = JSON.parse(response.choices[0].message.content);

        // Merge AI explanations back into book objects
        return books.map(book => {
            const match = aiResult.ranked.find(r => r.title.toLowerCase().includes(book.title.toLowerCase().substring(0, 10)));
            return {
                ...book,
                whyExplanation: match ? match.whyExplanation : "Recomendado com base no tema."
            };
        }).sort((a, b) => {
            const aIdx = aiResult.ranked.findIndex(r => r.title.toLowerCase().includes(a.title.toLowerCase().substring(0, 10)));
            const bIdx = aiResult.ranked.findIndex(r => r.title.toLowerCase().includes(b.title.toLowerCase().substring(0, 10)));
            if (aIdx === -1) return 1;
            if (bIdx === -1) return -1;
            return aIdx - bIdx;
        });
    } catch (err) {
        debugLog(`Erro rankAndExplain: ${err.message}`);
        return books;
    }
};

module.exports = {
    classifyDiscoveryQuery,
    rankAndExplain
};
