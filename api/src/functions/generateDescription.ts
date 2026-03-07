
import { app, HttpRequest, HttpResponseInit, InvocationContext } from "@azure/functions";
import { GoogleGenAI } from "@google/genai";

// Initialize Gemini with Server-Side Key
// This key comes from Azure Key Vault -> App Settings
const apiKey = process.env.GEMINI_API_KEY; 
const ai = apiKey ? new GoogleGenAI({ apiKey }) : null;

const SYSTEM_INSTRUCTION_AD = `
You are an expert copywriter for an Afghan online marketplace (like Facebook Marketplace).
Write a persuasive and clear sales description in Dari (Persian) for the item.
The tone should be polite, professional, and trustworthy. 
Highlight potential benefits. 
Keep it under 100 words.
Do not include placeholders like [Phone Number].
`;

export async function generateDescription(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
    context.log(`Http function processed request for url "${request.url}"`);

    if (!ai) {
        return { status: 500, jsonBody: { error: "Server configuration error: AI Key missing." } };
    }

    try {
        const body = await request.json() as any;
        const { title, category, location } = body;

        if (!title || !category) {
            return { status: 400, jsonBody: { error: "Title and Category are required." } };
        }

        const modelId = 'gemini-2.0-flash'; 
        const prompt = `Item Title: ${title}\nCategory: ${category}\nLocation: ${location || 'Afghanistan'}`;

        const response = await ai.models.generateContent({
            model: modelId,
            contents: prompt,
            config: {
                systemInstruction: SYSTEM_INSTRUCTION_AD,
            }
        });

        return {
            status: 200,
            jsonBody: { 
                description: response.text,
                generatedAt: new Date().toISOString()
            }
        };

    } catch (error) {
        context.error("Gemini API Error:", error);
        return { status: 500, jsonBody: { error: "Failed to generate content." } };
    }
}

app.http('generateDescription', {
    methods: ['POST'],
    authLevel: 'anonymous',
    route: 'generateDescription',
    handler: generateDescription
});
