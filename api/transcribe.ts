import { GoogleGenAI, Type } from '@google/genai';

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    timeout: 30000,
    headers: {
      'User-Agent': 'aistudio-build',
    },
  },
});

export default async function handler(req: any, res: any) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed. Use POST.' });
    return;
  }

  if (!process.env.GEMINI_API_KEY) {
    res.status(500).json({
      error: 'GEMINI_API_KEY is not configured. Please set your GEMINI_API_KEY environment variable in your Vercel Project Settings.',
    });
    return;
  }

  try {
    const { audioBase64, mimeType = 'audio/mp3', duration = 0, title = 'Uploaded Song' } = req.body;

    if (!audioBase64) {
      res.status(400).json({ error: 'Missing audioBase64 payload.' });
      return;
    }

    // Strip data URL prefix if present
    const base64Data = audioBase64.replace(/^data:[^;]+;base64,/, '');

    const systemInstruction = `
You are an expert multilingual music and lyrics transcriber specializing in Indian languages, with highest mastery in Telugu, Hindi, Tamil, and English.
You must analyze the provided song audio track with extreme acoustic precision and produce a synchronized lyric transcription.

Follow these strict rules:
1. Provide the exact Native script (Telugu script for Telugu songs, Devanagari for Hindi, Tamil script for Tamil, etc.) and accurate Romanized transliteration for each line.
2. For each line, specify precise start and end times in "mm:ss.s" format (e.g. "00:04.2").
3. Also provide startSeconds and endSeconds as floating-point numbers.
4. Mark any section where vocals are muffled or words cannot be deciphered with high certainty as [UNCLEAR].
5. Mark purely instrumental sections (solos, intros, beat drops, interludes, outros) where no vocals are sung as [INSTRUMENTAL].
6. DO NOT guess, hallucinate, or invent words. If unsure, mark as [UNCLEAR].
7. Provide the contextual English meaning/translation for each sung line.
8. Break down the key words in each line with their native word, Romanized pronunciation, and English meaning.
9. Identify the song title, film/album name, artists, music composer, and primary language if recognizable.
`;

    const prompt = `Transcribe the sung lyrics in this audio track.
Give me:
1. Native script (e.g., Telugu script) and Romanized transliteration for each line
2. Start and end time for each line in mm:ss.s format (e.g. 00:03.8)
3. Mark any section you are unsure of as [UNCLEAR]
4. Mark instrumental-only sections as [INSTRUMENTAL]
5. Contextual English meaning for each line
6. Word-by-word vocabulary breakdown
Total estimated audio duration: ${duration ? duration.toFixed(1) : 'unknown'} seconds.
Output your analysis in structured JSON matching the provided schema.`;

    const audioPart = {
      inlineData: {
        mimeType: mimeType || 'audio/mp3',
        data: base64Data,
      },
    };

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: {
        parts: [audioPart, { text: prompt }],
      },
      config: {
        systemInstruction,
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING, description: 'Song title' },
            movieOrAlbum: { type: Type.STRING, description: 'Film or album name' },
            artists: { type: Type.STRING, description: 'Singers or performers' },
            composer: { type: Type.STRING, description: 'Music composer / producer' },
            language: { type: Type.STRING, description: 'Language of the song (e.g. Telugu, Hindi, etc.)' },
            lines: {
              type: Type.ARRAY,
              description: 'Chronological list of transcribed lines and instrumental sections',
              items: {
                type: Type.OBJECT,
                properties: {
                  id: { type: Type.INTEGER, description: '1-indexed sequential line number' },
                  startTime: { type: Type.STRING, description: 'Start time in mm:ss.s format (e.g. 00:03.8)' },
                  endTime: { type: Type.STRING, description: 'End time in mm:ss.s format (e.g. 00:07.4)' },
                  startSeconds: { type: Type.NUMBER, description: 'Start time in total seconds' },
                  endSeconds: { type: Type.NUMBER, description: 'End time in total seconds' },
                  telugu: { type: Type.STRING, description: 'Native script (Telugu if Telugu song, or original script)' },
                  romanized: { type: Type.STRING, description: 'Romanized transliteration' },
                  englishMeaning: { type: Type.STRING, description: 'English translation and meaning' },
                  isInstrumental: { type: Type.BOOLEAN, description: 'True if purely instrumental without lyrics' },
                  isUnclear: { type: Type.BOOLEAN, description: 'True if vocals are unintelligible or uncertain' },
                  notes: { type: Type.STRING, description: 'Contextual notes, cultural references, or idioms' },
                  words: {
                    type: Type.ARRAY,
                    description: 'Optional key word meanings',
                    items: {
                      type: Type.OBJECT,
                      properties: {
                        telugu: { type: Type.STRING },
                        romanized: { type: Type.STRING },
                        meaning: { type: Type.STRING },
                      },
                    },
                  },
                },
                required: ['id', 'startTime', 'endTime', 'startSeconds', 'endSeconds', 'telugu', 'romanized', 'englishMeaning'],
              },
            },
          },
          required: ['title', 'language', 'lines'],
        },
      },
    });

    const rawText = response.text || '{}';
    let clean = rawText.trim();
    if (clean.startsWith('```json')) {
      clean = clean.replace(/^```json\s*/, '').replace(/\s*```$/, '');
    } else if (clean.startsWith('```')) {
      clean = clean.replace(/^```\s*/, '').replace(/\s*```$/, '');
    }

    const parsed = JSON.parse(clean);

    res.status(200).json({
      success: true,
      duration,
      transcription: parsed,
    });
  } catch (err: any) {
    console.error('Vercel API error:', err);
    let msg = err.message || 'Failed to transcribe audio on serverless runtime.';
    if (msg.includes('403') || msg.includes('PERMISSION_DENIED') || msg.includes('SCOPE_INSUFFICIENT')) {
      msg = 'Gemini API authentication failed (403: PERMISSION_DENIED). Please check your GEMINI_API_KEY environment variable in Vercel settings.';
    }
    res.status(500).json({
      error: msg,
    });
  }
}
