import axios from "axios";
import sanitizeHtml from "sanitize-html"; // Install via npm if not already present

export const chatWithAI = async (req, res) => {
  const { message } = req.body;

  if (!message || typeof message !== "string" || message.trim().length === 0) {
    return res.status(400).json({ error: "Invalid or missing message" });
  }

  if (!process.env.GEMINI_API_KEY) {
    return res.status(500).json({ error: "AI service configuration error" });
  }

  try {
    const sanitizedMessage = sanitizeHtml(message.trim(), {
      allowedTags: [],
      allowedAttributes: {},
    });

    const response = await axios.post(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
      {
        contents: [{ parts: [{ text: sanitizedMessage }] }],
      },
      { headers: { "Content-Type": "application/json" } }
    );

    const aiResponse = response.data.candidates[0].content.parts[0].text;
    res.status(200).json({ reply: aiResponse });
  } catch (error) {
    console.error(
      "Error calling Gemini API:",
      error.response?.data || error.message
    );
    const status = error.response?.status === 429 ? 429 : 500;
    const errorMsg =
      status === 429
        ? "Rate limit exceeded. Please try again later."
        : "Failed to get AI response";
    res.status(status).json({ error: errorMsg, details: error.message });
  }
};
