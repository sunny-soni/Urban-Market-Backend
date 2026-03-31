// routes/chat.js
import Groq from "groq-sdk";
import express from "express";
import { pool } from '../db.js';

const router = express.Router();
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

// ─── Helper: extract keywords from last 3 user messages ──────────
function extractKeywords(messages) {
  const stopWords = new Set([
    'i', 'me', 'my', 'want', 'need', 'looking', 'for', 'a', 'an',
    'the', 'is', 'are', 'do', 'you', 'have', 'can', 'show', 'me',
    'get', 'buy', 'find', 'some', 'any', 'good', 'best', 'what',
    'how', 'much', 'price', 'cost', 'cheap', 'expensive', 'please',
    'hi', 'hello', 'hey', 'thanks', 'thank', 'okay', 'yes', 'no'
  ]);

  const recentText = messages
    .filter(m => m.role === 'user')
    .slice(-3)                          // only last 3 user messages
    .map(m => m.content.toLowerCase())
    .join(' ');

  const keywords = recentText
    .replace(/[^a-z0-9\s]/g, '')        // strip punctuation
    .split(/\s+/)                        // split into words
    .filter(w => w.length > 2 && !stopWords.has(w));

  return [...new Set(keywords)];         // remove duplicates
}

// ─── Helper: fetch relevant products based on keywords ────────────
async function getRelevantProducts(keywords) {

  // No keywords (greeting, small talk etc.) → return popular products
  if (!keywords.length) {
    const { rows } = await pool.query(`
      SELECT p.name, p.price, p.category, p.description
      FROM products p
      LEFT JOIN order_items oi ON oi.product_id = p.id
      GROUP BY p.id
      ORDER BY COUNT(oi.id) DESC
      LIMIT 15
    `);
    return { products: rows, type: 'popular' };
  }

  // Build dynamic WHERE — each keyword checked across name, category, description
  const conditions = keywords
    .map((_, i) => `(
      LOWER(p.name)        LIKE $${i + 1} OR
      LOWER(p.category)    LIKE $${i + 1} OR
      LOWER(p.description) LIKE $${i + 1}
    )`)
    .join(' OR ');

  const values = keywords.map(k => `%${k}%`);

  const { rows: matched } = await pool.query(`
    SELECT
      p.name, p.price, p.category, p.description,
      COUNT(oi.id) AS popularity
    FROM products p
    LEFT JOIN order_items oi ON oi.product_id = p.id
    WHERE ${conditions}
    GROUP BY p.id
    ORDER BY popularity DESC
    LIMIT 20
  `, values);

  if (matched.length >= 1) {
    return { products: matched, type: 'keyword' };
  }

  // Keyword search found too few results → fallback to popular
  const { rows: fallback } = await pool.query(`
    SELECT p.name, p.price, p.category, p.description
    FROM products p
    LEFT JOIN order_items oi ON oi.product_id = p.id
    GROUP BY p.id
    ORDER BY COUNT(oi.id) DESC
    LIMIT 15
  `);
  return { products: fallback, type: 'fallback' };
}

// ─── Route ────────────────────────────────────────────────────────
router.post("/", async (req, res) => {
  const { messages, userId } = req.body;

  // 1. Extract keywords from conversation
  const keywords = extractKeywords(messages);

  // 2. Fetch only relevant products
  const { products, type } = await getRelevantProducts(keywords);

  // 3. Build product list string for the prompt
  const productList = products.length
    ? products
        .map(p => `- ${p.name} ($${p.price}) [${p.category}]: ${p.description}`)
        .join("\n")
    : "No products currently available.";

  // 4. Build system prompt
  const systemPrompt = `You are a helpful shopping assistant for our store.
${type === 'fallback' || type === 'popular'
  ? "Here are our popular products:"
  : "Here are our most relevant products for the customer's query:"}
${productList}

Rules:
- Only recommend products from the list above
- Keep responses short and friendly (2-3 sentences max)
- If asked about price, give exact prices from the list
- If the product the customer wants is not in the list, say "I don't think we carry that, but here's something similar:"
- Never make up products or prices
- Never suggest food products as alternatives to non-food items`;

  // Streaming headers
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  try {
    const stream = await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      messages: [
        { role: "system", content: systemPrompt },
        ...messages.slice(-10)
      ],
      stream: true,
      max_tokens: 400,
      temperature: 0.7,
    });

    for await (const chunk of stream) {
      const text = chunk.choices[0]?.delta?.content || "";
      if (text) res.write(`data: ${JSON.stringify({ text })}\n\n`);
    }

    res.write("data: [DONE]\n\n");
    res.end();

  } catch (err) {
    res.write(`data: ${JSON.stringify({ error: err.message })}\n\n`);
    res.end();
  }
});

export default router;