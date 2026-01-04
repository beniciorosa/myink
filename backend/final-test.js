const geminiService = require("./src/services/gemini.service");
require("dotenv").config();

async function test() {
    console.log("Iniciando teste do Gemini 3.0 Flash...");
    try {
        const data = await geminiService.generateBookStudyData("1984");
        console.log("SUCESSO!");
        process.exit(0);
    } catch (error) {
        console.error("ERRO NO TESTE:");
        console.error(error.message);
        if (error.stack) console.error(error.stack);
        process.exit(1);
    }
}

test();
