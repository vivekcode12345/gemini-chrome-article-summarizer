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

export function buildPrompt(summaryType, article) {
  switch (summaryType) {
    case "brief":
      return `You are a professional summarizer. Write a concise summary of the following article in exactly 2-3 clear sentences. Capture the primary thesis and key takeaway. You may use **bold** text for key concepts.\n\nArticle:\n${article}`;
    case "detailed":
      return `You are a professional summarizer. Write a comprehensive summary of the following article in 250-400 words. Organize the summary into well-structured paragraphs with clear section headings (###) and use **bold** text for important takeaways, terms, or metrics. Cover all key arguments and context.\n\nArticle:\n${article}`;
    case "bullets":
      return `You are a professional summarizer. Summarize the following article into 5-7 key takeaway bullet points. Format each point starting with "- " and use **bold** for the core concept at the start of each bullet point.\n\nArticle:\n${article}`;
    default:
      return `You are a professional summarizer. Summarize the following article in clear, natural language with markdown formatting where appropriate.\n\nArticle:\n${article}`;
  }
}

export async function getSummaryFromProvider(text, summaryType, providerId, apiKey) {
  const provider = getProvider(providerId);
  const maxLength = 30000;
  const article =
    text.length > maxLength ? text.substring(0, maxLength) + "..." : text;
  const prompt = buildPrompt(summaryType, article);

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

export async function* streamSummaryFromProvider(text, summaryType, providerId, apiKey) {
  const provider = getProvider(providerId);
  const maxLength = 30000;
  const article =
    text.length > maxLength ? text.substring(0, maxLength) + "..." : text;
  const prompt = buildPrompt(summaryType, article);

  if (!provider.supportsStreaming) {
    const full = await getSummaryFromProvider(text, summaryType, providerId, apiKey);
    yield full;
    return;
  }

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
