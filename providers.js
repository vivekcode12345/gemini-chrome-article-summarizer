export const AI_PROVIDERS = {
  gemini: {
    id: "gemini",
    label: "Google Gemini",
    description: "Fast, Google-native responses",
    apiKeyStorageKey: "geminiApiKey",
    defaultModel: "gemini-3.6-flash",
    host: "https://generativelanguage.googleapis.com",
    supportsStreaming: true,
    buildEndpoint: (model, apiKey) =>
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
    buildStreamEndpoint: (model, apiKey) =>
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?key=${apiKey}&alt=sse`,
    buildRequest: (prompt, model) => ({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.3,
        maxOutputTokens: 2048,
        topP: 0.95,
        topK: 40,
      },
    }),
    buildStreamRequest: (prompt, model) => ({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.3,
        maxOutputTokens: 2048,
        topP: 0.95,
        topK: 40,
      },
    }),
    parseResponse: (data) => {
      if (
        data.candidates &&
        data.candidates.length &&
        data.candidates[0].content &&
        data.candidates[0].content.parts &&
        data.candidates[0].content.parts.length
      ) {
        return data.candidates[0].content.parts[0].text.trim();
      }
      throw new Error("No summary returned by provider.");
    },
    parseStreamChunk: (chunk) => {
      const text = chunk?.candidates?.[0]?.content?.parts?.[0]?.text;
      return typeof text === "string" ? text : "";
    },
    needsAuthHeader: false,
  },
  openai: {
    id: "openai",
    label: "OpenAI",
    description: "GPT-4o family, versatile",
    apiKeyStorageKey: "openaiApiKey",
    defaultModel: "gpt-4o-mini",
    host: "https://api.openai.com",
    supportsStreaming: true,
    buildEndpoint: (model) => `https://api.openai.com/v1/chat/completions`,
    buildStreamEndpoint: (model) => `https://api.openai.com/v1/chat/completions`,
    buildRequest: (prompt) => ({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content:
            "You are a professional summarizer. Produce well-structured markdown summaries.",
        },
        { role: "user", content: prompt },
      ],
      temperature: 0.3,
      max_tokens: 2048,
      top_p: 0.95,
    }),
    buildStreamRequest: (prompt) => ({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content:
            "You are a professional summarizer. Produce well-structured markdown summaries.",
        },
        { role: "user", content: prompt },
      ],
      temperature: 0.3,
      max_tokens: 2048,
      top_p: 0.95,
      stream: true,
    }),
    parseResponse: (data) => {
      const text = data?.choices?.[0]?.message?.content;
      if (typeof text === "string" && text.trim()) return text.trim();
      throw new Error("No summary returned by provider.");
    },
    parseStreamChunk: (chunk) => {
      const delta = chunk?.choices?.[0]?.delta?.content;
      return typeof delta === "string" ? delta : "";
    },
    needsAuthHeader: true,
    authHeader: (apiKey) => ({ Authorization: `Bearer ${apiKey}` }),
  },
  anthropic: {
    id: "anthropic",
    label: "Anthropic",
    description: "Claude family, nuanced",
    apiKeyStorageKey: "anthropicApiKey",
    defaultModel: "claude-3-5-haiku-20241022",
    host: "https://api.anthropic.com",
    supportsStreaming: false,
    buildEndpoint: () => `https://api.anthropic.com/v1/messages`,
    buildStreamEndpoint: () => `https://api.anthropic.com/v1/messages`,
    buildRequest: (prompt) => ({
      model: "claude-3-5-haiku-20241022",
      max_tokens: 2048,
      temperature: 0.3,
      top_p: 0.95,
      system:
        "You are a professional summarizer. Produce well-structured markdown summaries.",
      messages: [{ role: "user", content: prompt }],
    }),
    buildStreamRequest: (prompt) => ({
      model: "claude-3-5-haiku-20241022",
      max_tokens: 2048,
      temperature: 0.3,
      top_p: 0.95,
      stream: true,
      system:
        "You are a professional summarizer. Produce well-structured markdown summaries.",
      messages: [{ role: "user", content: prompt }],
    }),
    parseResponse: (data) => {
      const text = data?.content?.[0]?.text;
      if (typeof text === "string" && text.trim()) return text.trim();
      throw new Error("No summary returned by provider.");
    },
    parseStreamChunk: (chunk) => {
      const delta = chunk?.delta?.text;
      return typeof delta === "string" ? delta : "";
    },
    needsAuthHeader: true,
    authHeader: (apiKey) => ({
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    }),
  },
};

export function getProvider(id) {
  const provider = AI_PROVIDERS[id];
  if (!provider) throw new Error(`Unsupported AI provider: ${id}`);
  return provider;
}

export const SUMMARY_LANGUAGES = [
  { code: "en", label: "English" },
  { code: "hi", label: "Hindi" },
  { code: "es", label: "Spanish" },
  { code: "fr", label: "French" },
  { code: "de", label: "German" },
  { code: "pt", label: "Portuguese" },
  { code: "it", label: "Italian" },
  { code: "zh", label: "Chinese (Simplified)" },
  { code: "ja", label: "Japanese" },
  { code: "ko", label: "Korean" },
  { code: "ar", label: "Arabic" },
];

export function getLanguageLabel(code) {
  const found = SUMMARY_LANGUAGES.find((l) => l.code === code);
  return found ? found.label : "English";
}

export function buildPrompt(summaryType, article, language = "en") {
  let base;
  switch (summaryType) {
    case "brief":
      base = `You are a professional summarizer. Write a concise summary of the following article in exactly 2-3 clear sentences. Capture the primary thesis and key takeaway. You may use **bold** text for key concepts.\n\nArticle:\n${article}`;
      break;
    case "detailed":
      base = `You are a professional summarizer. Write a comprehensive summary of the following article in 250-400 words. Organize the summary into well-structured paragraphs with clear section headings (###) and use **bold** text for important takeaways, terms, or metrics. Cover all key arguments and context.\n\nArticle:\n${article}`;
      break;
    case "bullets":
      base = `You are a professional summarizer. Summarize the following article into 5-7 key takeaway bullet points. Format each point starting with "- " and use **bold** for the core concept at the start of each bullet point.\n\nArticle:\n${article}`;
      break;
    default:
      base = `You are a professional summarizer. Summarize the following article in clear, natural language with markdown formatting where appropriate.\n\nArticle:\n${article}`;
      break;
  }
  // Default is English — keep the prompt byte-identical for English so
  // existing behaviour does not change; other languages get an instruction.
  if (language && language !== "en") {
    return `Write the entire summary in ${getLanguageLabel(language)}. Keep markdown formatting (**, ###, -) unchanged.\n\n${base}`;
  }
  return base;
}

export const MULTI_TAB_MAX_LENGTH = 30000;

// Build a combined prompt from multiple tab sources.
// sources: [{ title, url, text }] — each text is truncated to a fair share
// of the total budget so one long tab can't starve the others.
export function buildMultiTabPrompt(summaryType, sources, language = "en") {
  const usable = (Array.isArray(sources) ? sources : []).filter(
    (s) => s && typeof s.text === "string" && s.text.trim().length >= 100
  );
  const n = Math.max(usable.length, 1);
  const perTab = Math.floor(MULTI_TAB_MAX_LENGTH / n);
  const sections = usable.map((s, i) => {
    const title = (s.title || `Tab ${i + 1}`).trim() || `Tab ${i + 1}`;
    const url = (s.url || "").trim();
    let text = s.text.trim();
    if (text.length > perTab) text = text.substring(0, perTab) + "...";
    return `--- SOURCE ${i + 1}/${usable.length}: ${title}${url ? ` (${url})` : ""} ---\n${text}`;
  });
  const combined = sections.join("\n\n");
  const framing =
    `You are given article text extracted from ${usable.length} browser tabs. ` +
    `Summarize them together as one coherent summary. Where the tabs cover different topics, ` +
    `organize the summary per source; where they overlap, synthesize and note agreements or differences.`;
  return buildPrompt(summaryType, `${framing}\n\n${combined}`, language);
}

async function postPrompt(provider, apiKey, prompt) {
  const endpoint = provider.buildEndpoint(provider.defaultModel, apiKey);
  const body = provider.buildRequest(prompt, provider.defaultModel);
  const headers = {
    "Content-Type": "application/json",
    ...(provider.needsAuthHeader ? provider.authHeader(apiKey) : {}),
  };

  const response = await fetch(endpoint, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });

  const data = await response.json();

  if (!response.ok) {
    console.error(`${provider.label} API Error Response:`, data);
    const providerName = provider.label;
    throw new Error(
      data?.error?.message ||
        JSON.stringify(data?.error) ||
        `Unknown ${providerName} API Error`
    );
  }

  return provider.parseResponse(data);
}

async function* streamPrompt(provider, apiKey, prompt) {
  const endpoint = provider.buildStreamEndpoint(provider.defaultModel, apiKey);
  const body = provider.buildStreamRequest(prompt, provider.defaultModel);
  const headers = {
    "Content-Type": "application/json",
    ...(provider.needsAuthHeader ? provider.authHeader(apiKey) : {}),
  };

  const response = await fetch(endpoint, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    console.error(`${provider.label} Stream API Error Response:`, data);
    const providerName = provider.label;
    throw new Error(
      data?.error?.message ||
        JSON.stringify(data?.error) ||
        `Unknown ${providerName} API Error`
    );
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() || "";

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("event:") || trimmed.startsWith(":")) continue;
      if (trimmed.startsWith("data:")) {
        const payload = trimmed.slice(5).trim();
        if (payload === "[DONE]") return;
        try {
          const json = JSON.parse(payload);
          const chunk = provider.parseStreamChunk(json);
          if (chunk) yield chunk;
        } catch {
          // skip malformed chunk
        }
      }
    }
  }
}

export async function getSummaryFromProvider(text, summaryType, providerId, apiKey, language = "en") {
  const provider = getProvider(providerId);
  const maxLength = 30000;
  const article =
    text.length > maxLength ? text.substring(0, maxLength) + "..." : text;
  const prompt = buildPrompt(summaryType, article, language);
  return postPrompt(provider, apiKey, prompt);
}

export async function* streamSummaryFromProvider(text, summaryType, providerId, apiKey, language = "en") {
  const provider = getProvider(providerId);
  if (!provider.supportsStreaming) {
    yield await getSummaryFromProvider(text, summaryType, providerId, apiKey, language);
    return;
  }
  const maxLength = 30000;
  const article =
    text.length > maxLength ? text.substring(0, maxLength) + "..." : text;
  const prompt = buildPrompt(summaryType, article, language);
  yield* streamPrompt(provider, apiKey, prompt);
}

export async function getMultiTabSummaryFromProvider(sources, summaryType, providerId, apiKey, language = "en") {
  const provider = getProvider(providerId);
  return postPrompt(provider, apiKey, buildMultiTabPrompt(summaryType, sources, language));
}

export async function* streamMultiTabSummaryFromProvider(sources, summaryType, providerId, apiKey, language = "en") {
  const provider = getProvider(providerId);
  if (!provider.supportsStreaming) {
    yield await getMultiTabSummaryFromProvider(sources, summaryType, providerId, apiKey, language);
    return;
  }
  yield* streamPrompt(provider, apiKey, buildMultiTabPrompt(summaryType, sources, language));
}
