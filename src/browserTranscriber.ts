import { GoogleGenAI, Type } from '@google/genai';

export const USER_API_KEY_STORAGE = 'telugu_lyrics_user_api_key_v1';

export function getStoredUserApiKey(): string {
  try {
    return localStorage.getItem(USER_API_KEY_STORAGE) || '';
  } catch {
    return '';
  }
}

export function saveStoredUserApiKey(key: string): void {
  try {
    if (key.trim()) {
      localStorage.setItem(USER_API_KEY_STORAGE, key.trim());
    } else {
      localStorage.removeItem(USER_API_KEY_STORAGE);
    }
  } catch (e) {
    console.warn('Failed to save API key to localStorage', e);
  }
}

export function removeStoredUserApiKey(): void {
  try {
    localStorage.removeItem(USER_API_KEY_STORAGE);
  } catch (e) {
    console.warn('Failed to remove API key from localStorage', e);
  }
}

function isTransientError(err: any): boolean {
  if (!err) return false;
  const status = err.status || err.code || err.error?.code || err.error?.status;
  if (status === 503 || status === 'UNAVAILABLE' || status === 429 || status === 'RESOURCE_EXHAUSTED') {
    return true;
  }
  const str = (
    (err.message || '') +
    ' ' +
    (typeof err === 'string' ? err : JSON.stringify(err))
  ).toLowerCase();
  return (
    str.includes('503') ||
    str.includes('unavailable') ||
    str.includes('high demand') ||
    str.includes('overloaded') ||
    str.includes('temporarily') ||
    str.includes('429') ||
    str.includes('resource_exhausted') ||
    str.includes('rate limit')
  );
}

/**
 * Direct REST fallback for browser environments
 */
async function callGeminiRest(
  model: string,
  apiKey: string,
  base64Audio: string,
  mimeType: string,
  prompt: string,
  systemInstruction: string
): Promise<string> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      systemInstruction: {
        parts: [{ text: systemInstruction }],
      },
      contents: [
        {
          parts: [
            {
              inlineData: {
                mimeType,
                data: base64Audio,
              },
            },
            {
              text: prompt,
            },
          ],
        },
      ],
      generationConfig: {
        responseMimeType: 'application/json',
      },
    }),
  });

  const data = await res.json();
  if (!res.ok) {
    const err = new Error(data.error?.message || `Google API error (${res.status})`);
    (err as any).status = res.status;
    (err as any).error = data.error;
    throw err;
  }
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) {
    throw new Error('Empty response received from Gemini.');
  }
  return text;
}

/**
 * Transcribes audio completely in the user's browser
 * using their personal Gemini API key.
 * Audio stays 100% in the user's local browser memory.
 */
export async function transcribeInBrowser(
  audioBase64: string,
  mimeType: string,
  apiKey: string,
  estimatedDurationSec: number = 0,
  onStatusUpdate?: (status: string) => void
): Promise<any> {
  const cleanKey = apiKey.trim();
  if (!cleanKey) {
    throw new Error('Please enter your Google Gemini API key to transcribe in your browser.');
  }

  // Strip data: prefix if present
  const base64Data = audioBase64.replace(/^data:[^;]+;base64,/, '');

  const ai = new GoogleGenAI({
    apiKey: cleanKey,
    httpOptions: {
      timeout: 60000,
      headers: {
        'User-Agent': 'aistudio-build-browser',
      },
    },
  });

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
Total estimated audio duration: ${estimatedDurationSec > 0 ? estimatedDurationSec.toFixed(1) : 'unknown'} seconds.
Output your analysis in structured JSON matching the provided schema.`;

  const audioPart = {
    inlineData: {
      mimeType: mimeType || 'audio/mp3',
      data: base64Data,
    },
  };

  const candidateModels = ['gemini-3.8-flash', 'gemini-flash-latest', 'gemini-3.5-transcribe', 'gemini-3.1-flash-lite'];
  let rawText: string | null = null;
  let lastError: any = null;

  for (const model of candidateModels) {
    try {
      if (onStatusUpdate) {
        onStatusUpdate(`Analyzing lyrics directly with ${model}...`);
      }

      // Try SDK first
      try {
        const response = await ai.models.generateContent({
          model,
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
                      id: { type: Type.INTEGER, description: 'Sequential line number' },
                      startTime: { type: Type.STRING, description: 'Start time in mm:ss.s format (e.g. 00:03.8)' },
                      endTime: { type: Type.STRING, description: 'End time in mm:ss.s format (e.g. 00:07.4)' },
                      startSeconds: { type: Type.NUMBER, description: 'Start time in total seconds' },
                      endSeconds: { type: Type.NUMBER, description: 'End time in total seconds' },
                      telugu: { type: Type.STRING, description: 'Native script' },
                      romanized: { type: Type.STRING, description: 'Romanized transliteration' },
                      englishMeaning: { type: Type.STRING, description: 'English translation and meaning' },
                      isInstrumental: { type: Type.BOOLEAN, description: 'True if purely instrumental without lyrics' },
                      isUnclear: { type: Type.BOOLEAN, description: 'True if vocals are unintelligible or uncertain' },
                      notes: { type: Type.STRING, description: 'Contextual notes or idioms' },
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
        if (response && response.text) {
          rawText = response.text;
          break;
        }
      } catch (sdkErr: any) {
        console.warn(`[Browser SDK] Falling back to direct REST for ${model}:`, sdkErr.message);
        rawText = await callGeminiRest(model, cleanKey, base64Data, mimeType || 'audio/mp3', prompt, systemInstruction);
        if (rawText) {
          break;
        }
      }
    } catch (err: any) {
      lastError = err;
      console.warn(`[Browser Gemini] Model ${model} error:`, err);
      if (isTransientError(err)) {
        if (onStatusUpdate) {
          onStatusUpdate(`High demand on ${model}, trying fallback model...`);
        }
        await new Promise((r) => setTimeout(r, 1200));
        continue;
      }
      const errStr = (err.message || '') + JSON.stringify(err);
      if (errStr.includes('API_KEY_INVALID') || errStr.includes('API key not valid') || err.status === 400) {
        throw new Error('Your Gemini API key is invalid. Please verify your key at Google AI Studio (aistudio.google.com) and try again.');
      }
      throw err;
    }
  }

  if (!rawText) {
    if (lastError && isTransientError(lastError)) {
      throw new Error('Gemini AI models are temporarily experiencing high demand (503 UNAVAILABLE). Please click "Retry Transcription" in a moment.');
    }
    throw lastError || new Error('Could not get response from Gemini AI. Please check your API key.');
  }

  let clean = rawText.trim();
  if (clean.startsWith('```json')) {
    clean = clean.replace(/^```json\s*/, '').replace(/\s*```$/, '');
  } else if (clean.startsWith('```')) {
    clean = clean.replace(/^```\s*/, '').replace(/\s*```$/, '');
  }

  try {
    return JSON.parse(clean);
  } catch (parseErr: any) {
    throw new Error(`Failed to parse lyrics JSON: ${parseErr.message}`);
  }
}
