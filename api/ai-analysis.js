import OpenAI from "openai";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export default async function handler(req, res) {
  const data = req.body;

  const completion = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      { role: "system", content: "You are a disciplined weekly swing trader." },
      { role: "user", content: JSON.stringify(data) }
    ]
  });

  res.json({ analysis: completion.choices[0].message.content });
}