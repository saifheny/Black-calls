// api/generate.js
const fetch = require('node-fetch');

const GEMINI_API_KEY = process.env.GEMINI_API_KEY; 
const GEMINI_ENDPOINT = https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${GEMINI_API_KEY};

module.exports = async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*'); 
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).send();
    }

    if (!GEMINI_API_KEY) {
        return res.status(500).json({ error: 'المفتاح السري غير موجود. الرجاء إعداده في Vercel.' });
    }

    try {
        const userPrompt = req.body.idea;

        const requestBody = {
            "contents": [{
                "parts": [{
                    "text": اكتب لي قصة قصيرة (3 أو 4 أسطر) بناءً على هذه الفكرة: "${userPrompt}"
                }]
            }]
        };

        const apiResponse = await fetch(GEMINI_ENDPOINT, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(requestBody)
        });

        const data = await apiResponse.json();
        const storyText = data.candidates[0].content.parts[0].text;

        res.status(200).json({ storyText: storyText });

    } catch (error) {
        console.error("API Error:", error);
        res.status(500).json({ error: 'فشل في توليد القصة.' });
    }
};
