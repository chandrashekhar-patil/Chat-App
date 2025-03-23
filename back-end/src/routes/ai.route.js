// backend/routes/ai.route.js
import express from "express";
import { GoogleGenerativeAI } from "@google/generative-ai";
import NodeCache from "node-cache";
import { protectRoute } from "../middleware/auth.middleware.js";
import { config } from "dotenv";

config();

const router = express.Router();
const cache = new NodeCache({ stdTTL: 3600 });
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// Helper function to format code-related responses into markdown
const formatCodeResponse = (message, aiResponse) => {
  const isCodeQuery =
    message.toLowerCase().includes("write") &&
    message.toLowerCase().includes("code");
  if (!isCodeQuery) {
    return `**Response:**\n\n${aiResponse}`;
  }

  const languageMatch = message.toLowerCase().match(/write\s+(\w+)\s+code/i);
  const language = languageMatch ? languageMatch[1].toLowerCase() : "text";

  let formattedResponse = `## Writing the Code\n\nLet's create the requested program in ${language.toUpperCase()}.\n\n`;

  const lines = aiResponse.split("\n").filter((line) => line.trim());
  let codeBlock = "";
  let explanation = "";
  let inCodeBlock = false;

  for (const line of lines) {
    if (line.trim().startsWith("```")) {
      inCodeBlock = !inCodeBlock;
      continue;
    }
    if (inCodeBlock) {
      codeBlock += line + "\n";
    } else {
      explanation += line + "\n";
    }
  }

  if (!codeBlock && lines.length > 0) {
    codeBlock = lines.join("\n");
  }

  formattedResponse += `### Code\n\n\`\`\`${language}\n${codeBlock.trim()}\n\`\`\`\n\n`;

  if (explanation.trim()) {
    formattedResponse += `### Explanation\n\n${explanation.trim()}\n\n`;
  }

  if (language === "c++") {
    formattedResponse += `### Steps to Run\n\n1. **Save the Code**:\n   - Save the code in a file named \`hello.cpp\`.\n\n2. **Compile the Code**:\n   - Open a terminal and navigate to the file's directory.\n   - Run:\n     \`\`\`bash\n     g++ hello.cpp -o hello\n     \`\`\`\n\n3. **Run the Program**:\n   - Execute the compiled program:\n     \`\`\`bash\n     ./hello\n     \`\`\`\n   - **Output**:\n     \`\`\`\n     Hello, world!\n     \`\`\`\n`;
  }

  return formattedResponse;
};

router.post("/chat", protectRoute, async (req, res) => {
  try {
    const { message } = req.body;
    if (!message || typeof message !== "string") {
      return res
        .status(400)
        .json({ error: "Message is required and must be a string" });
    }

    const cacheKey = `ai_response_${message}`;
    const cachedResponse = cache.get(cacheKey);
    if (cachedResponse) {
      return res.status(200).json({ reply: cachedResponse });
    }

    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    const result = await model.generateContent(message.trim());
    const reply = result.response.text();

    const formattedReply = formatCodeResponse(message, reply);

    cache.set(cacheKey, formattedReply);
    res.status(200).json({ reply: formattedReply });
  } catch (error) {
    console.error("AI route error:", error.stack);
    res
      .status(error.status || 500)
      .json({ error: error.message || "Failed to process AI request" });
  }
});

export default router;
