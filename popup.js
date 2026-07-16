async function getGeminiSummary(text, summaryType, apiKey) {
  const maxLength = 20000;
  const truncatedText =
    text.length > maxLength ? text.substring(0, maxLength) + "..." : text;

  let prompt = "";

  switch (summaryType) {
    case "brief":
      prompt = `Provide a brief summary of the following article in 2-3 sentences:\n\n${truncatedText}`;
      break;

    case "detailed":
      prompt = `Provide a detailed summary of the following article covering all important points:\n\n${truncatedText}`;
      break;

    case "bullets":
      prompt = `Summarize the following article into 5-7 bullet points:\n\n${truncatedText}`;
      break;

    default:
      prompt = `Summarize the following article:\n\n${truncatedText}`;
  }

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  text: prompt,
                },
              ],
            },
          ],
          generationConfig: {
            temperature: 0.3,
            maxOutputTokens: 1024,
          },
        }),
      }
    );

    const data = await response.json();

    console.log("Gemini Response:", data);

    if (!response.ok) {
      throw new Error(data.error?.message || "Gemini API Error");
    }

    if (
      data.candidates &&
      data.candidates.length > 0 &&
      data.candidates[0].content &&
      data.candidates[0].content.parts &&
      data.candidates[0].content.parts.length > 0
    ) {
      return data.candidates[0].content.parts[0].text;
    }

    throw new Error("No summary returned from Gemini.");

  } catch (err) {
    console.error(err);
    throw new Error(err.message);
  }
}