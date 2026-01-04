
import { GoogleGenAI, Type } from "@google/genai";
import { BookStudyData } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export async function generateBookStudyData(bookTitle: string): Promise<BookStudyData> {
  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: `Analise o livro "${bookTitle}". Gere um pacote de estudos abrangente em PORTUGUÊS BRASILEIRO, incluindo: um resumo, 12 flashcards de mergulho profundo (cobrindo temas, filosofia e análise crítica) e um quiz de 10 perguntas para compreensão profunda. Foque em pensamento crítico e conceitos que ampliem horizontes.`,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          title: { type: Type.STRING },
          author: { type: Type.STRING },
          summary: { type: Type.STRING },
          flashcards: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                id: { type: Type.STRING },
                front: { type: Type.STRING, description: "A pergunta ou conceito na frente do cartão" },
                back: { type: Type.STRING, description: "A resposta ou definição no verso" },
                insight: { type: Type.STRING, description: "Um insight crítico profundo ou provocação de pensamento relacionada" }
              },
              required: ["id", "front", "back", "insight"]
            }
          },
          quiz: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                id: { type: Type.STRING },
                question: { type: Type.STRING },
                options: { 
                  type: Type.ARRAY,
                  items: { type: Type.STRING }
                },
                correctAnswerIndex: { type: Type.NUMBER },
                explanation: { type: Type.STRING, description: "Por que esta resposta está correta e o que ela revela sobre os temas do livro" }
              },
              required: ["id", "question", "options", "correctAnswerIndex", "explanation"]
            }
          }
        },
        required: ["title", "author", "summary", "flashcards", "quiz"]
      }
    }
  });

  if (!response.text) {
    throw new Error("Falha ao gerar dados do livro.");
  }

  return JSON.parse(response.text) as BookStudyData;
}
