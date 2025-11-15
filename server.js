const express = require('express');
const fetch = require('node-fetch');
const cors = require('cors'); // لتجنب مشاكل الاتصال
const app = express();
// يستخدم المنفذ الذي تحدده Render، أو 3000 إذا كنت تجرب محلياً
const port = process.env.PORT || 3000; 

// 🔴 لا تضع المفتاح هنا! سنقرأه من بيئة التشغيل في Render
const GEMINI_API_KEY = process.env.GEMINI_API_KEY; 
const GEMINI_ENDPOINT = https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${GEMINI_API_KEY};

// إعدادات Express
app.use(express.json()); 
app.use(cors()); 

// نقطة الاتصال التي سيستخدمها المتصفح: /generate
app.post('/generate', async (req, res) => {
    const userPrompt = req.body.idea; 

    if (!userPrompt) {
        return res.status(400).json({ error: 'الرجاء إرسال فكرة.' });
    }

    if (!GEMINI_API_KEY) {
        return res.status(500).json({ error: 'المفتاح السري (API Key) غير موجود في بيئة التشغيل.' });
    }

    try {
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
        
        // استخلاص النص
        const storyText = data.candidates[0].content.parts[0].text;
        
        // إرسال النتيجة إلى المتصفح (Frontend)
        res.json({ storyText: storyText });

    } catch (error) {
        console.error("API Error:", error);
        res.status(500).json({ error: 'فشل في توليد القصة عبر الـ API.' });
    }
});

app.listen(port, () => {
    console.log(🚀 الخادم يعمل الآن على المنفذ: ${port});
});
