const express = require("express");
const cors = require("cors");
require("dotenv").config({ override: true });

const geminiService = require("./services/gemini.service");

const app = express();
app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: '20mb' }));

app.get("/api/health", (req, res) => {
    res.json({ status: "ok", env: process.env.NODE_ENV });
});

// Middleware para LOG de requisições no painel Vercel
app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
    next();
});
app.post("/api/flashcards", async (req, res) => {
    const { title, author, summary } = req.body;
    try {
        const data = await geminiService.fetchFlashcards(title, author, summary);
        res.json(data);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Falha ao gerar flashcards." });
    }
});

app.post("/api/quiz", async (req, res) => {
    const { title, author, summary } = req.body;
    try {
        const data = await geminiService.fetchQuiz(title, author, summary);
        res.json(data);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Falha ao gerar quiz." });
    }
});

app.post("/api/book-info", async (req, res) => {
    const { title } = req.body;
    if (!title) return res.status(400).json({ error: "Título não enviado." });
    try {
        const info = await geminiService.fetchBookBasicInfo(title);
        res.json(info);
    } catch (error) {
        console.error("ERRO NO ENDPOINT /book-info:", error);
        res.status(500).json({ error: error.message });
    }
});

app.post("/api/search", async (req, res) => {
    const { query, filters } = req.body;
    if (!query && !filters) return res.status(400).json({ error: "Busca vazia." });
    try {
        const results = await geminiService.searchBooks(query, filters);
        res.json(results);
    } catch (error) {
        console.error("ERRO NO ENDPOINT /api/search:", error);
        res.status(500).json({ error: "Falha na busca inteligente." });
    }
});

app.post("/api/deep-analysis", async (req, res) => {
    const { title, author, synopsis } = req.body;
    if (!title) return res.status(400).json({ error: "Título não enviado." });
    try {
        const analysis = await geminiService.generateDeepAnalysis(title, author, synopsis);
        res.json(analysis);
    } catch (error) {
        console.error("ERRO NO ENDPOINT /deep-analysis:", error);
        res.status(500).json({ error: "Falha ao gerar análise profunda." });
    }
});

app.post("/api/book-editions", async (req, res) => {
    const { title, author } = req.body;
    if (!title) return res.status(400).json({ error: "Título não enviado." });
    try {
        const editions = await geminiService.fetchOtherEditions(title, author);
        res.json(editions);
    } catch (error) {
        console.error("ERRO NO ENDPOINT /book-editions:", error);
        res.status(500).json({ error: "Falha ao buscar edições." });
    }
});

app.post("/api/ocr-isbn", async (req, res) => {
    const { image } = req.body;
    if (!image) return res.status(400).json({ error: "Imagem não enviada." });
    try {
        const isbn = await geminiService.extractIsbnFromImage(image);
        res.json({ isbn });
    } catch (error) {
        console.error("ERRO NO ENDPOINT /ocr-isbn:", error);
        res.status(500).json({ error: "Falha na extração de ISBN via IA." });
    }
});

app.post("/api/force-cover", async (req, res) => {
    const { title, author, isbn, publisher } = req.body;
    if (!title) return res.status(400).json({ error: "Título não enviado." });
    try {
        const coverData = await geminiService.searchBookCover(title, author, isbn, publisher);
        res.json(coverData);
    } catch (error) {
        console.error("ERRO NO ENDPOINT /force-cover:", error);
        res.status(500).json({ error: error.message });
    }
});

if (process.env.NODE_ENV !== 'production') {
    app.listen(PORT, () => {
        console.log(`Servidor rodando na porta ${PORT}`);
    });
}

module.exports = app;
