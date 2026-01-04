const { GoogleGenerativeAI } = require("@google/generative-ai");
const fs = require('fs');
require("dotenv").config({ override: true });

function debugLog(msg) {
  const timestamp = new Date().toISOString();
  const line = `[${timestamp}] ${msg}`;
  if (process.env.NODE_ENV !== 'production') {
    try {
      fs.appendFileSync('debug_flow.log', line + '\n');
    } catch (e) {
      console.error("Erro ao escrever no arquivo de log:", e.message);
    }
  }
  console.log(line);
}

function sanitizeJson(str) {
  // Remove caracteres de controle que quebram o JSON.parse (como novas linhas literais dentro de strings)
  // Mas mantém \n, \r, \t escapados.
  return str.replace(/[\u0000-\u001F\u007F-\u009F]/g, "");
}

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

const getOpenLibraryData = async (isbn) => {
  try {
    const cleanIsbn = isbn.replace(/\D/g, '');
    const url = `https://openlibrary.org/api/books?bibkeys=ISBN:${cleanIsbn}&format=json&jscmd=data`;
    debugLog(`Buscando metadata no OpenLibrary: ${url}`);
    const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
    const data = await res.json();

    const bookKey = `ISBN:${cleanIsbn}`;
    if (data[bookKey]) {
      const info = data[bookKey];
      return {
        coverUrl: info.cover?.large || info.cover?.medium || info.cover?.small || null,
        pages: info.number_of_pages || null,
        resolvedTitle: info.title,
        resolvedAuthor: info.authors ? info.authors[0].name : null,
        genre: info.subjects ? info.subjects[0].name : null,
        synopsis: info.notes || info.excerpt || null
      };
    }
    return null;
  } catch (err) {
    debugLog(`Erro ao buscar no OpenLibrary: ${err.message}`);
    return null;
  }
};

const classifySearchQuery = async (query) => {
  try {
    const model = genAI.getGenerativeModel({
      model: "gemini-2.0-flash",
      generationConfig: { responseMimeType: "application/json" }
    });
    const prompt = `Analise a intenção de busca do usuário: "${query}".
    Classifique em um destes tipos:
    1. "TITLE": O usuário busca um livro específico pelo nome.
    2. "AUTHOR": O usuário busca obras de um autor específico.
    3. "PUBLISHER": O usuário busca livros de uma editora específica (ex: "Livros da Intrínseca", "Editora Aleph").
    4. "DISCOVERY": O usuário quer sugestões sobre um tema ou gênero.
    
    Retorne JSON:
    { "type": "TITLE" | "AUTHOR" | "PUBLISHER" | "DISCOVERY", "value": "termo limpo" }`;

    const result = await model.generateContent(prompt);
    return JSON.parse(sanitizeJson(result.response.text()));
  } catch (err) {
    debugLog(`Erro classifySearchQuery: ${err.message}`);
    return { type: "TITLE", value: query };
  }
};

const searchBooks = async (query, filters = {}) => {
  try {
    // Se temos filtros explícitos (busca avançada), pulamos a classificação
    let intent;
    if (filters.title || filters.author || filters.publisher) {
      intent = { type: 'COMPLEX', value: query };
    } else {
      intent = await classifySearchQuery(query);
    }

    debugLog(`Intenção de busca: ${intent.type} para "${intent.value}"`);

    let books = [];
    const key = process.env.GOOGLE_BOOKS_API_KEY;

    if (intent.type === "AUTHOR" || intent.type === "PUBLISHER" || intent.type === "COMPLEX") {
      let q = '';
      if (intent.type === "AUTHOR") q = `inauthor:${encodeURIComponent(intent.value)}`;
      else if (intent.type === "PUBLISHER") q = `inpublisher:${encodeURIComponent(intent.value)}`;
      else {
        // Busca Complexa (Avançada)
        const parts = [];
        if (filters.title) parts.push(`intitle:${encodeURIComponent(filters.title)}`);
        if (filters.author) parts.push(`inauthor:${encodeURIComponent(filters.author)}`);
        if (filters.publisher) parts.push(`inpublisher:${encodeURIComponent(filters.publisher)}`);
        if (parts.length === 0) parts.push(encodeURIComponent(query));
        q = parts.join('+');
      }

      // Adicionando um pequeno "boost" para o título se disponível
      if (filters.title) {
        q = `intitle:${encodeURIComponent(filters.title)}+${q}`;
      }

      const url = `https://www.googleapis.com/books/v1/volumes?q=${q}&maxResults=15&orderBy=relevance&langRestrict=pt${key ? `&key=${key}` : ''}`;
      debugLog(`URL Busca Avançada: ${url}`);
      const res = await fetch(url);
      const data = await res.json();

      books = (data.items || []).map(item => {
        const cover = (
          item.volumeInfo.imageLinks?.extraLarge ||
          item.volumeInfo.imageLinks?.large ||
          item.volumeInfo.imageLinks?.medium ||
          item.volumeInfo.imageLinks?.small ||
          item.volumeInfo.imageLinks?.thumbnail ||
          item.volumeInfo.imageLinks?.smallThumbnail ||
          null
        )?.replace("http://", "https://");

        return {
          id: item.id,
          title: item.volumeInfo.title,
          author: item.volumeInfo.authors ? item.volumeInfo.authors[0] : 'Desconhecido',
          coverUrl: cover,
          publisher: item.volumeInfo.publisher || 'Desconhecida',
          isbn: item.volumeInfo.industryIdentifiers?.find(id => id.type === 'ISBN_13')?.identifier || null
        };
      });
    } else if (intent.type === "DISCOVERY") {
      const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash", generationConfig: { responseMimeType: "application/json" } });
      const prompt = `O usuário quer "${intent.value}". Sugira 8 livros famosos e importantes sobre esse tema (focando em edições brasileiras).
      Retorne JSON:
      { "suggestions": [ { "title": "Título", "author": "Autor" }, ... ] }`;
      const result = await model.generateContent(prompt);
      const suggestions = JSON.parse(sanitizeJson(result.response.text())).suggestions;

      // Para cada sugestão, pegamos uma info básica rápida
      books = await Promise.all(suggestions.map(async (s) => {
        try {
          const url = `https://www.googleapis.com/books/v1/volumes?q=intitle:${encodeURIComponent(s.title)}+inauthor:${encodeURIComponent(s.author)}&maxResults=1${key ? `&key=${key}` : ''}`;
          const res = await fetch(url);
          const data = await res.json();
          if (data.items?.[0]) {
            const item = data.items[0];
            const cover = (
              item.volumeInfo.imageLinks?.extraLarge ||
              item.volumeInfo.imageLinks?.large ||
              item.volumeInfo.imageLinks?.medium ||
              item.volumeInfo.imageLinks?.small ||
              item.volumeInfo.imageLinks?.thumbnail ||
              item.volumeInfo.imageLinks?.smallThumbnail ||
              null
            )?.replace("http://", "https://");

            return {
              id: item.id,
              title: item.volumeInfo.title,
              author: item.volumeInfo.authors ? item.volumeInfo.authors[0] : s.author,
              coverUrl: cover,
              isbn: item.volumeInfo.industryIdentifiers?.find(id => id.type === 'ISBN_13')?.identifier || null
            };
          }
          return { title: s.title, author: s.author, id: Math.random().toString(), coverUrl: null, isbn: null };
        } catch (e) {
          return { title: s.title, author: s.author, id: Math.random().toString(), coverUrl: null, isbn: null };
        }
      }));
    } else {
      // Intent TÍTULO ou fallback: Agora sempre retorna MÚLTIPLOS resultados
      // Usamos aspas duplas para forçar a busca exata dos termos no Google Books
      const q = encodeURIComponent(`"${query}"`);
      const url = `https://www.googleapis.com/books/v1/volumes?q=intitle:${q}&maxResults=40&orderBy=relevance&langRestrict=pt${key ? `&key=${key}` : ''}`;
      debugLog(`URL Busca Geral Estrita: ${url}`);
      const res = await fetch(url);
      const data = await res.json();

      const searchTerms = query.toLowerCase().split(/\s+/).filter(w => w.length > 2);

      books = (data.items || [])
        .map(item => {
          const cover = (
            item.volumeInfo.imageLinks?.extraLarge ||
            item.volumeInfo.imageLinks?.large ||
            item.volumeInfo.imageLinks?.medium ||
            item.volumeInfo.imageLinks?.small ||
            item.volumeInfo.imageLinks?.thumbnail ||
            item.volumeInfo.imageLinks?.smallThumbnail ||
            null
          )?.replace("http://", "https://");

          return {
            id: item.id,
            title: item.volumeInfo.title,
            author: item.volumeInfo.authors ? item.volumeInfo.authors[0] : 'Desconhecido',
            coverUrl: cover,
            publisher: item.volumeInfo.publisher || 'Desconhecida',
            isbn: item.volumeInfo.industryIdentifiers?.find(id => id.type === 'ISBN_13')?.identifier || null
          };
        })
        .filter(b => {
          // Filtro adicional de segurança: o título deve conter os termos principais da busca
          const titleLower = b.title.toLowerCase();
          return searchTerms.every(term => titleLower.includes(term));
        });
    }

    return books;
  } catch (err) {
    console.error("Erro searchBooks:", err);
    throw err;
  }
};

const resolveIdentityFromTitle = async (query) => {
  try {
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
    const prompt = `Você é um bibliotecário experiente. O usuário digitou a seguinte busca: "${query}".
    Sua tarefa é identificar qual é o livro mais provável que ele está procurando no Brasil.
    REGRAS:
    1. Se for um título famoso com o artigo (ex: "O Cujo"), resolva para o título correto e mais conhecido (ex: "Cujo" de Stephen King).
    2. Retorne APENAS "Título | Autor".
    3. Se for muito ambíguo, escolha a obra mais relevante/famosa.
    4. Não adicione comentários, apenas "Título | Autor".
    5. Se parecer um tema, retorne o livro mais importante/clássico sobre esse tema.`;
    const result = await model.generateContent(prompt);
    const text = result.response.text().trim();
    if (!text.includes("|")) return null;
    const [title, author] = text.split("|").map(s => s.trim());
    debugLog(`Identidade resolvida via IA: ${title} | ${author}`);
    return { title, author };
  } catch (err) {
    debugLog(`Erro resolveIdentityFromTitle: ${err.message}`);
    return null;
  }
};

const identifyBookByIsbn = async (isbn) => {
  try {
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
    const prompt = `Você é um bibliotecário especializado em edições brasileiras. 
    Analise o ISBN ${isbn} e identifique o livro. 
    REGRAS:
    1. Seja precido. Se for 9788551003657, ele é "Por que nós dormimos" da Intrínseca.
    2. Retorne APENAS "Título | Autor".
    3. Se não tiver certeza absoluta baseada no seu banco de dados, retorne "UNKNOWN". Não chute clássicos como "O Pequeno Príncipe".
    4. Responda apenas o texto, sem explicações.`;
    const result = await model.generateContent(prompt);
    const text = result.response.text().trim();
    if (text.includes("UNKNOWN") || !text.includes("|")) return null;
    const [title, author] = text.split("|").map(s => s.trim());
    debugLog(`Identificação IA resolvida: ${title} | ${author}`);
    return { title, author };
  } catch (err) {
    return null;
  }
};

const getBrasilApiData = async (isbn) => {
  try {
    const cleanIsbn = isbn.replace(/\D/g, '');
    const url = `https://brasilapi.com.br/api/isbn/v1/${cleanIsbn}`;
    debugLog(`Buscando no BrasilAPI: ${url}`);
    const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) return null;
    const data = await res.json();
    return {
      resolvedTitle: data.title,
      resolvedAuthor: data.authors && data.authors.length > 0 ? data.authors[0] : null,
      publisher: data.publisher,
      pages: data.page_count > 0 ? data.page_count : null,
      genre: data.subjects && data.subjects.length > 0 ? data.subjects[0] : null,
      synopsis: data.synopsis || null
    };
  } catch (err) {
    debugLog(`Erro BrasilAPI: ${err.message}`);
    return null;
  }
};

const getBetterCover = async (title, author) => {
  try {
    const key = process.env.GOOGLE_BOOKS_API_KEY;

    // Detectar se o "título" na verdade é um ISBN
    const isbnClean = title.replace(/-/g, '').replace(/\D/g, '');
    const isIsbn = /^(97(8|9))?\d{9}(\d|X)$/.test(isbnClean);

    // Se for ISBN e Brasileiro (começa com 85, 97885, 97865), tenta BrasilAPI primeiro
    let resolvedFromBrasil = null;
    if (isIsbn && (isbnClean.startsWith('85') || isbnClean.startsWith('97885') || isbnClean.startsWith('97865'))) {
      resolvedFromBrasil = await getBrasilApiData(isbnClean);
      if (resolvedFromBrasil) {
        debugLog(`BrasilAPI encontrou: ${resolvedFromBrasil.resolvedTitle}`);
      }
    }

    let query;
    if (isIsbn) {
      // Se BrasilAPI trouxe título, usamos ele para buscar capa no Google, senão busca por ISBN
      query = resolvedFromBrasil ? encodeURIComponent(resolvedFromBrasil.resolvedTitle) : encodeURIComponent(`isbn:${isbnClean}`);
    } else {
      const cleanTitle = title.replace(/[^\w\s]/gi, '').trim();
      const cleanAuthor = author ? author.replace(/[^\w\s]/gi, '').trim() : '';
      query = encodeURIComponent(`intitle:${cleanTitle}${cleanAuthor ? ` inauthor:${cleanAuthor}` : ''}`);
    }

    let url = `https://www.googleapis.com/books/v1/volumes?q=${query}&maxResults=1${key ? `&key=${key}` : ''}`;
    debugLog(`Buscando metadata (Query 1): ${url}`);
    let res = await fetch(url);
    let data = await res.json();

    // Se search por ISBN falhou, tenta busca geral pelo número (alguns livros não estão indexados pelo prefixo isbn:)
    if ((!data.items || data.items.length === 0) && isIsbn) {
      const generalIsbnQuery = title.replace(/\D/g, '');
      url = `https://www.googleapis.com/books/v1/volumes?q=${generalIsbnQuery}&maxResults=1${key ? `&key=${key}` : ''}`;
      debugLog(`Buscando metadata (Query 2 - General ISBN): ${url}`);
      res = await fetch(url);
      data = await res.json();
    }

    // Se falhar a busca específica e não for ISBN, tenta busca geral
    if ((!data.items || data.items.length === 0) && !isIsbn) {
      const cleanTitle = title.replace(/[^\w\s]/gi, '').trim();
      const cleanAuthor = author ? author.replace(/[^\w\s]/gi, '').trim() : '';
      const generalQuery = encodeURIComponent(`${cleanTitle} ${cleanAuthor}`);
      url = `https://www.googleapis.com/books/v1/volumes?q=${generalQuery}&maxResults=1${key ? `&key=${key}` : ''}`;
      debugLog(`Buscando metadata (Query Geral): ${url}`);
      res = await fetch(url);
      data = await res.json();
    }

    if (data.items && data.items[0] && data.items[0].volumeInfo) {
      const info = data.items[0].volumeInfo;
      const links = info.imageLinks;
      let bestCover = links ? (links.extraLarge || links.large || links.medium || links.small || links.thumbnail || links.smallThumbnail) : null;

      // Use a more aggressive approach for high resolution
      if (bestCover && bestCover.includes('books.google.com/books')) {
        // Fife is critical for high-res covers and safer than forcing zoom=3
        bestCover = bestCover.replace('&edge=curl', '');
        if (!bestCover.includes('fife=')) {
          bestCover += '&fife=w1200';
        }
      }
      const secureCover = bestCover ? bestCover.replace("http://", "https://") : null;

      const isbnObj = info.industryIdentifiers?.find(id => id.type === 'ISBN_13') || info.industryIdentifiers?.[0];
      const genre = info.categories ? info.categories[0] : null;

      debugLog(`Informações encontradas no Google: ${info.title}`);

      // Se não tem capa no Google e é ISBN, tenta OpenLibrary
      let finalCover = secureCover;
      let finalPages = info.pageCount;
      let finalGenre = genre;

      if (!finalCover && isIsbn) {
        const olData = await getOpenLibraryData(title);
        if (olData?.coverUrl) finalCover = olData.coverUrl;
        if (!finalPages && olData?.pages) finalPages = olData.pages;
        if (!finalGenre && olData?.genre) finalGenre = olData.genre;
      }

      return {
        coverUrl: finalCover,
        pages: finalPages,
        isbn: isbnObj?.identifier || (isIsbn ? isbnClean : null),
        genre: finalGenre,
        publisher: resolvedFromBrasil?.publisher || info.publisher || null,
        synopsis: resolvedFromBrasil?.synopsis || info.description || null,
        resolvedTitle: resolvedFromBrasil?.resolvedTitle || info.title,
        resolvedAuthor: resolvedFromBrasil?.resolvedAuthor || (info.authors ? info.authors[0] : null),
        publishDate: info.publishedDate || null
      };
    }

    // Se falhou Google e é ISBN, tenta BrasilAPI e depois OpenLibrary
    if (isIsbn) {
      const bData = resolvedFromBrasil || await getBrasilApiData(isbnClean);
      if (bData) {
        // Tenta buscar capa pelo título descoberto no BrasilAPI
        const coverOnly = await getBetterCover(bData.resolvedTitle, bData.resolvedAuthor || "");
        return {
          coverUrl: coverOnly.coverUrl,
          pages: bData.pages || coverOnly.pages,
          isbn: isbnClean,
          genre: bData.genre || coverOnly.genre,
          publisher: bData.publisher || coverOnly.publisher,
          synopsis: bData.synopsis || coverOnly.synopsis,
          resolvedTitle: bData.resolvedTitle,
          resolvedAuthor: bData.resolvedAuthor || coverOnly.resolvedAuthor
        };
      }

      const olData = await getOpenLibraryData(isbnClean);
      if (olData) {
        return {
          coverUrl: olData.coverUrl,
          pages: olData.pages,
          isbn: title,
          genre: olData.genre,
          resolvedTitle: olData.resolvedTitle,
          resolvedAuthor: olData.resolvedAuthor
        };
      }
    }

    return { coverUrl: null, pages: null, isbn: null, genre: null, publisher: null, synopsis: null, resolvedTitle: null, resolvedAuthor: null };
  } catch (err) {
    console.error("Erro ao buscar informações:", err);
    return { coverUrl: null, pages: null, isbn: null, genre: null, publisher: null, synopsis: null, resolvedTitle: null, resolvedAuthor: null };
  }
};

const fetchBookBasicInfo = async (bookTitle) => {
  try {
    const isIsbn = /^(97(8|9))?\d{9}(\d|X)$/.test(bookTitle.replace(/-/g, '').replace(/\D/g, ''));
    let searchTitle = bookTitle;
    let searchAuthor = "";

    // 1. Resolver identidade se não for ISBN (Evita resultados "merda" como obscure biography para "O CUJO")
    if (!isIsbn) {
      const identity = await resolveIdentityFromTitle(bookTitle);
      if (identity) {
        searchTitle = identity.title;
        searchAuthor = identity.author;
      }
    }

    // 2. Resolver metadados (APIs Externas)
    let extraInfo = await getBetterCover(searchTitle, searchAuthor);

    // 2. Se for ISBN e APIs falharam no título, usamos a IA para identificar ANTES de tudo
    if (isIsbn && !extraInfo.resolvedTitle) {
      debugLog(`ISBN não resolvido pelas APIs. Pedindo ajuda ao Gemini para identificar: ${bookTitle}`);
      const identity = await identifyBookByIsbn(bookTitle);
      if (identity) {
        debugLog(`Gemini identificou o ISBN como: ${identity.title} por ${identity.author}`);
        extraInfo.resolvedTitle = identity.title;
        extraInfo.resolvedAuthor = identity.author;
        // Tentar buscar informações agora que temos um título
        const technicalData = await getBetterCover(identity.title, identity.author);
        extraInfo = { ...technicalData, resolvedTitle: identity.title, resolvedAuthor: identity.author };
      }
    }

    const finalResult = {
      title: extraInfo.resolvedTitle || bookTitle,
      author: extraInfo.resolvedAuthor || "Autor Desconhecido",
      publisher: extraInfo.publisher,
      pages: extraInfo.pages,
      isbn: extraInfo.isbn,
      genre: extraInfo.genre,
      coverUrl: extraInfo.coverUrl || `https://placehold.co/400x600/f8fafc/64748b?text=${encodeURIComponent(extraInfo.resolvedTitle || bookTitle)}`,
      synopsis: extraInfo.synopsis || null,
      originalTitle: null,
      publishDate: extraInfo.publishDate || null
    };

    // 3. Se não tem sinopse, gera uma rápida via IA
    if (!finalResult.synopsis) {
      debugLog("Sinopse não encontrada. Gerando resumo rápido via IA...");
      const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
      const prompt = `Escreva uma sinopse cativante e profissional para o livro "${finalResult.title}" de ${finalResult.author}.
      IMPORTANTE: Use exatamente 2 ou 3 parágrafos, separando-os com uma linha em branco.
      Use um tom editorial. Responda apenas o texto da sinopse.`;
      const result = await model.generateContent(prompt);
      finalResult.synopsis = result.response.text().trim();
    }

    // Tentar extrair ano de publicação do Google se disponível
    if (!finalResult.publishDate && extraInfo.publishDate) {
      finalResult.publishDate = extraInfo.publishDate.substring(0, 4);
    }

    // 3. Etapa de Localização e Título Original (Rápida - 1 seg)
    try {
      const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash", generationConfig: { responseMimeType: "application/json" } });
      const locPrompt = `Localize estes dados para o português brasileiro:
      Obra: "${finalResult.title}" por "${finalResult.author}"
      Gênero Original: "${finalResult.genre || 'Desconhecido'}"
      
      Retorne JSON:
      {
        "translatedGenre": "gênero traduzido",
        "originalTitle": "título na língua original do autor (se for brasileiro, repita o título)",
        "publishYear": "apenas o ano"
      }`;
      const locResult = await model.generateContent(locPrompt);
      const locData = JSON.parse(sanitizeJson(locResult.response.text()));

      if (locData.translatedGenre) finalResult.genre = locData.translatedGenre;
      if (locData.originalTitle) finalResult.originalTitle = locData.originalTitle;
      if (locData.publishYear && locData.publishYear !== "0") finalResult.publishDate = String(locData.publishYear);
    } catch (locErr) {
      debugLog(`Erro na localização: ${locErr.message}`);
    }

    // Double check year formatting
    if (finalResult.publishDate) {
      finalResult.publishDate = String(finalResult.publishDate).substring(0, 4);
    }

    debugLog(`Informações básicas concluídas: ${finalResult.title}`);
    return finalResult;
  } catch (error) {
    console.error("Erro no fetchBookBasicInfo:", error);
    throw error;
  }
};

const generateDeepAnalysis = async (title, author, synopsis) => {
  try {
    const model = genAI.getGenerativeModel({
      model: "gemini-2.0-flash",
      generationConfig: { responseMimeType: "application/json" }
    });

    const prompt = `Você é um crítico literário e bibliotecário especializado em análises profundas.
    Analise o livro "${title}" do autor "${author}".
    Baseie-se também nesta sinopse se necessário: "${synopsis}".

    Retorne UM ÚNICO OBJETO JSON com estas chaves:
    {
      "originalTitle": "título original (no idioma do autor)",
      "publishDate": "ano da primeira publicação",
      "aiSummary": "resumo brasileiro profundo e crítico focado em análise literária, subtexto e importância histórica (mínimo 800 caracteres, sem enrolação)"
    }
    Não use markdown. Responda APENAS o objeto JSON.`;

    debugLog(`Iniciando generateDeepAnalysis para: ${title}`);
    const result = await model.generateContent(prompt);
    const text = result.response.text();

    let parsed;
    try {
      parsed = JSON.parse(sanitizeJson(text));
    } catch (e) {
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      parsed = JSON.parse(sanitizeJson(jsonMatch[0]));
    }

    return parsed;
  } catch (err) {
    console.error("Erro no generateDeepAnalysis:", err);
    throw err;
  }
};

const fetchFlashcards = async (title, author, summary) => {
  try {
    const model = genAI.getGenerativeModel({
      model: "gemini-2.0-flash",
      generationConfig: { responseMimeType: "application/json" }
    });
    const prompt = `Com base no livro "${title}" de ${author} e neste resumo: "${summary}", gere EXATAMENTE 8 flashcards técnicos e profundos.
  REGRAS DE OURO (MUITO IMPORTANTE):
  1. QUANTIDADE: O campo "flashcards" DEVE ser uma lista com EXATAMENTE 8 (OITO) ITENS. Se você enviar menos de 8, o sistema falhará. 
  2. FORMATO: Responda APENAS com o JSON, sem markdown ou explicações.
  3. IDIOMA: Português Brasileiro.

  JSON SCHEMA:
  {
    "flashcards": [
      { "id": "1", "front": "Conceito 1", "back": "Resp 1", "insight": "Insight 1" },
      { "id": "2", "front": "Conceito 2", "back": "Resp 2", "insight": "Insight 2" },
      { "id": "3", "front": "Conceito 3", "back": "Resp 3", "insight": "Insight 3" },
      { "id": "4", "front": "Conceito 4", "back": "Resp 4", "insight": "Insight 4" },
      { "id": "5", "front": "Conceito 5", "back": "Resp 5", "insight": "Insight 5" },
      { "id": "6", "front": "Conceito 6", "back": "Resp 6", "insight": "Insight 6" },
      { "id": "7", "front": "Conceito 7", "back": "Resp 7", "insight": "Insight 7" },
      { "id": "8", "front": "Conceito 8", "back": "Resp 8", "insight": "Insight 8" }
    ]
  }`;

    console.log("Gerando flashcards para:", title);
    const result = await model.generateContent(prompt);

    // Verificar se houve bloqueio por segurança
    const candidate = result.response.candidates[0];
    if (candidate.finishReason === 'SAFETY') {
      console.error("CONTEÚDO BLOQUEADO PELA IA (SEGURANÇA):", candidate.safetyRatings);
      throw new Error("A IA bloqueou a geração de flashcards por motivos de segurança.");
    }

    const responseText = result.response.text();

    let parsed;
    try {
      const cleanText = sanitizeJson(responseText);
      parsed = JSON.parse(cleanText);
    } catch (e) {
      debugLog(`Erro no parse de flashcards: ${e.message}. Tentando fallback.`);
      const jsonMatch = responseText.match(/\{[\s\S]*\}/) || responseText.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        try {
          parsed = JSON.parse(sanitizeJson(jsonMatch[0]));
        } catch (err) {
          throw new Error("Falha ao parsear flashcards.");
        }
      } else {
        throw new Error("IA não retornou flashcards válidos.");
      }
    }

    if (Array.isArray(parsed)) {
      // Se for um array direto, maravilha. Se for um objeto com chave flashcards, pegamos a chave.
      return parsed;
    } else if (parsed.flashcards) {
      return parsed.flashcards;
    }

    return [];
  } catch (error) {
    console.error("Erro ao gerar flashcards:", error);
    throw error;
  }
};

const fetchQuiz = async (title, author, summary) => {
  try {
    const model = genAI.getGenerativeModel({
      model: "gemini-2.0-flash",
      generationConfig: { responseMimeType: "application/json" }
    });
    const prompt = `Com base no livro "${title}" de ${author}, gere um quiz de 10 perguntas.
  REGRAS DE OURO (MUITO IMPORTANTE):
  1. QUANTIDADE: O campo "quiz" DEVE ser uma lista com EXATAMENTE 10 (DEZ) ITENS. Se você enviar menos de 10, o sistema falhará. 
  2. FORMATO: Responda APENAS com o JSON, sem markdown ou explicações.
  3. IDIOMA: Português Brasileiro.

  JSON SCHEMA:
  {
    "quiz": [
      { "id": "1", "question": "...", "options": ["...", "...", "...", "..."], "correctAnswerIndex": 0, "explanation": "..." },
      { "id": "2", "question": "...", "options": ["...", "...", "...", "..."], "correctAnswerIndex": 0, "explanation": "..." },
      { "id": "3", "question": "...", "options": ["...", "...", "...", "..."], "correctAnswerIndex": 0, "explanation": "..." },
      { "id": "4", "question": "...", "options": ["...", "...", "...", "..."], "correctAnswerIndex": 0, "explanation": "..." },
      { "id": "5", "question": "...", "options": ["...", "...", "...", "..."], "correctAnswerIndex": 0, "explanation": "..." },
      { "id": "6", "question": "...", "options": ["...", "...", "...", "..."], "correctAnswerIndex": 0, "explanation": "..." },
      { "id": "7", "question": "...", "options": ["...", "...", "...", "..."], "correctAnswerIndex": 0, "explanation": "..." },
      { "id": "8", "question": "...", "options": ["...", "...", "...", "..."], "correctAnswerIndex": 0, "explanation": "..." },
      { "id": "9", "question": "...", "options": ["...", "...", "...", "..."], "correctAnswerIndex": 0, "explanation": "..." },
      { "id": "10", "question": "...", "options": ["...", "...", "...", "..."], "correctAnswerIndex": 0, "explanation": "..." }
    ]
  }`;

    console.log("Gerando quiz para:", title);
    const result = await model.generateContent(prompt);

    // Verificar se houve bloqueio por segurança
    const candidate = result.response.candidates[0];
    if (candidate.finishReason === 'SAFETY') {
      console.error("CONTEÚDO BLOQUEADO PELA IA (SEGURANÇA):", candidate.safetyRatings);
      throw new Error("A IA bloqueou a geração do quiz por motivos de segurança.");
    }

    const responseText = result.response.text();

    let parsed;
    try {
      const cleanText = sanitizeJson(responseText);
      parsed = JSON.parse(cleanText);
    } catch (e) {
      debugLog(`Erro no parse de quiz: ${e.message}. Tentando fallback.`);
      const jsonMatch = responseText.match(/\{[\s\S]*\}/) || responseText.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        try {
          parsed = JSON.parse(sanitizeJson(jsonMatch[0]));
        } catch (err) {
          throw new Error("Falha ao parsear quiz.");
        }
      } else {
        throw new Error("IA não retornou quiz válido.");
      }
    }

    if (Array.isArray(parsed)) {
      return parsed;
    } else if (parsed.quiz) {
      return parsed.quiz;
    }

    return [];
  } catch (error) {
    console.error("Erro ao gerar quiz:", error);
    throw error;
  }
};

const extractIsbnFromImage = async (base64Image) => {
  try {
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
    const base64Data = base64Image.split(',')[1] || base64Image;
    const prompt = "Analise esta imagem de um livro e extraia APENAS o número do ISBN (13 dígitos). Se houver vários números, retorne apenas o ISBN-13 (apenas dígitos). Se não encontrar, retorne 'NOT_FOUND'. Não escreva mais nada.";
    const result = await model.generateContent([
      prompt,
      { inlineData: { data: base64Data, mimeType: "image/jpeg" } }
    ]);
    const responseText = result.response.text().trim();
    const isbnMatch = responseText.match(/\d{10,13}/);
    return isbnMatch ? isbnMatch[0] : null;
  } catch (error) {
    console.error("Erro ao extrair ISBN via Gemini:", error);
    return null;
  }
};

const fetchOtherEditions = async (title, author) => {
  try {
    const key = process.env.GOOGLE_BOOKS_API_KEY;
    const cleanTitle = title.replace(/[^\w\s]/gi, '').trim();
    const cleanAuthor = author ? author.replace(/[^\w\s]/gi, '').trim() : '';

    // Multi-stage search strategy with extreme resilience
    let items = [];

    // Stage 1: Strict match (No quotes for better compatibility)
    const q1 = `intitle:${cleanTitle}${cleanAuthor ? ` inauthor:${cleanAuthor}` : ''}`;
    const url1 = `https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(q1)}&maxResults=40&langRestrict=pt${key ? `&key=${key}` : ''}`;
    debugLog(`Buscando edições (S1): ${url1}`);
    const res1 = await fetch(url1);
    const data1 = await res1.json();
    items = data1.items || [];

    // Stage 2: Title and Author as generic keywords
    if (items.length < 10) {
      const q2 = `${cleanTitle} ${cleanAuthor}`;
      const url2 = `https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(q2)}&maxResults=40&langRestrict=pt${key ? `&key=${key}` : ''}`;
      debugLog(`Buscando edições (S2): ${url2}`);
      const res2 = await fetch(url2);
      const data2 = await res2.json();
      if (data2.items) {
        const existingIds = new Set(items.map(it => it.id));
        data2.items.forEach(it => { if (!existingIds.has(it.id)) items.push(it); });
      }
    }

    // Stage 3: Title only (Broad)
    if (items.length < 10) {
      const url3 = `https://www.googleapis.com/books/v1/volumes?q=intitle:${encodeURIComponent(cleanTitle)}&maxResults=40&langRestrict=pt${key ? `&key=${key}` : ''}`;
      debugLog(`Buscando edições (S3): ${url3}`);
      const res3 = await fetch(url3);
      const data3 = await res3.json();
      if (data3.items) {
        const existingIds = new Set(items.map(it => it.id));
        data3.items.forEach(it => { if (!existingIds.has(it.id)) items.push(it); });
      }
    }

    if (items.length === 0) return [];

    const editions = items.map(item => {
      const info = item.volumeInfo;
      const isbnObj = info.industryIdentifiers?.find(id => id.type === 'ISBN_13') || info.industryIdentifiers?.[0];
      const year = info.publishedDate ? info.publishedDate.substring(0, 4) : 'N/A';
      const language = info.language || 'unk';
      const publisher = info.publisher || 'N/A';

      return {
        id: item.id,
        title: info.title,
        author: info.authors ? info.authors[0] : 'Desconhecido',
        publisher: publisher,
        year: year,
        isbn: isbnObj?.identifier || null,
        coverUrl: info.imageLinks?.thumbnail?.replace("http://", "https://") || null,
        language: language
      };
    })
      .filter(ed => ed.publisher !== 'N/A' || ed.isbn) // Relaxed: allow if it has at least one of them
      .filter(ed => {
        const titleLower = ed.title.toLowerCase();
        const originalTitleLower = title.toLowerCase();
        const pubLower = ed.publisher.toLowerCase();

        // Strict title match to avoid unrelated books
        // Fuzzy title match: check if significant words from the original are present
        const searchWords = originalTitleLower.split(/\s+/).filter(w => w.length > 3);
        const isSameBook = searchWords.length > 0
          ? searchWords.every(w => titleLower.includes(w)) || titleLower.includes(originalTitleLower) || originalTitleLower.includes(titleLower)
          : true;
        if (!isSameBook) return false;

        const looksPt = ed.language?.startsWith('pt') || titleLower.includes('portugu') || pubLower.includes('brasil') || pubLower.includes('editora') || pubLower.includes('edição');

        // Exclude confirmed foreign only if they don't look like PT
        if (['en', 'fr', 'ja', 'de', 'it'].includes(ed.language) && !looksPt) {
          return false;
        }
        return true;
      })
      .filter((v, i, a) => a.findIndex(t => (t.isbn === v.isbn)) === i);

    debugLog(`Total de edições filtradas: ${editions.length}`);

    // Ordenar por ano (descendente)
    return editions.sort((a, b) => {
      const yearA = a.year === 'N/A' ? 0 : parseInt(a.year);
      const yearB = b.year === 'N/A' ? 0 : parseInt(b.year);
      return yearB - yearA;
    }).slice(0, 10);

  } catch (err) {
    debugLog(`Erro ao buscar edições: ${err.message}`);
    return [];
  }
};

const searchBookCover = async (title, author, isbn = null, publisher = null) => {
  try {
    const key = process.env.GOOGLE_BOOKS_API_KEY;
    const queries = [];

    // Priority: ISBN > Title+Author+Publisher > Title+Author
    if (isbn) queries.push(`isbn:${isbn}`);
    if (publisher && publisher !== 'Desconhecida') {
      queries.push(`intitle:${title.replace(/[^\w\s]/gi, '')} inauthor:${author.replace(/[^\w\s]/gi, '')} inpublisher:${publisher.replace(/[^\w\s]/gi, '')}`);
    }
    queries.push(`intitle:${title.replace(/[^\w\s]/gi, '')} inauthor:${author.replace(/[^\w\s]/gi, '')}`);
    queries.push(`${title}`);

    for (const q of queries) {
      const url = `https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(q)}&maxResults=10${key ? `&key=${key}` : ''}`;
      debugLog(`Busca de Precisão (Query): ${q}`);
      const res = await fetch(url);
      const data = await res.json();

      if (data.items) {
        let bestMatch = null;
        let highestScore = -1;

        for (const item of data.items) {
          const info = item.volumeInfo;
          let score = 0;

          const cover = (
            info.imageLinks?.extraLarge ||
            info.imageLinks?.large ||
            info.imageLinks?.medium ||
            info.imageLinks?.small ||
            info.imageLinks?.thumbnail ||
            null
          )?.replace("http://", "https://");

          // CRITICAL: We WANT a cover. A result without a cover is low priority.
          if (cover) score += 50;
          if (info.imageLinks?.extraLarge || info.imageLinks?.large) score += 20;

          // Match publisher (Case-insensitive partial match)
          if (publisher && info.publisher) {
            const normTarget = publisher.toLowerCase();
            const normFound = info.publisher.toLowerCase();
            if (normFound.includes(normTarget) || normTarget.includes(normFound)) {
              score += 100;
            }
          }

          // ISBN match
          const foundIsbn = info.industryIdentifiers?.find(id => id.type === 'ISBN_13')?.identifier;
          if (isbn && foundIsbn === isbn) {
            score += 200;
          }

          if (score > highestScore && (cover || (info.publisher && publisher && info.publisher.toLowerCase().includes(publisher.toLowerCase())))) {
            highestScore = score;
            bestMatch = {
              coverUrl: cover,
              publisher: info.publisher || null,
              pages: info.pageCount || null,
              publishDate: info.publishedDate || null,
              isbn: foundIsbn || isbn
            };
          }
        }

        if (bestMatch && (highestScore > 50 || bestMatch.coverUrl)) {
          debugLog(`Best match found with score ${highestScore}: ${bestMatch.publisher}`);
          return bestMatch;
        }
      }
    }
    return { coverUrl: null };
  } catch (err) {
    console.error("Erro searchBookCover:", err);
    return { coverUrl: null };
  }
};

module.exports = {
  fetchBookBasicInfo,
  generateDeepAnalysis,
  fetchFlashcards,
  fetchQuiz,
  extractIsbnFromImage,
  fetchOtherEditions,
  searchBooks,
  searchBookCover
};
