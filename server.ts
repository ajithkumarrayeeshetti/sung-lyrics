import 'dotenv/config';
import express, { Request, Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { exec, spawn } from 'child_process';
import { GoogleGenAI, Type } from '@google/genai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

// Ensure upload and output directories exist
const UPLOADS_DIR = path.resolve(__dirname, 'uploads');
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

// Multer storage configuration
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, UPLOADS_DIR);
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname) || '.mp3';
    const uniqueName = `audio_${Date.now()}_${Math.random().toString(36).substring(2, 8)}${ext}`;
    cb(null, uniqueName);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 40 * 1024 * 1024 }, // 40 MB max
  fileFilter: (_req, file, cb) => {
    // accept audio formats
    if (file.mimetype.startsWith('audio/') || file.mimetype.startsWith('video/') || file.originalname.match(/\.(mp3|wav|m4a|ogg|webm|flac|aac|mp4)$/i)) {
      cb(null, true);
    } else {
      cb(new Error('Only audio/video files are supported.'));
    }
  },
});

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Serve uploaded audio files
app.use('/uploads', express.static(UPLOADS_DIR));

// Initialize GoogleGenAI with timeout
const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    timeout: 30000, // 30 second timeout prevents endless retries
    headers: {
      'User-Agent': 'aistudio-build',
    },
  },
});

/**
 * Helper to run shell commands as promises
 */
function runShell(command: string): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    exec(command, { maxBuffer: 10 * 1024 * 1024 }, (err, stdout, stderr) => {
      if (err) {
        reject(new Error(stderr || err.message));
      } else {
        resolve({ stdout, stderr });
      }
    });
  });
}

/**
 * Optimizes/compresses audio using ffmpeg to 16kHz mono MP3
 * This ensures fast upload to Gemini and stays well within token/size limits.
 */
async function compressAudio(inputPath: string, outputPath: string): Promise<number> {
  // -ar 16000: 16kHz sample rate (optimal for speech recognition)
  // -ac 1: mono
  // -b:a 64k: 64kbps mp3
  const cmd = `ffmpeg -y -i "${inputPath}" -vn -ar 16000 -ac 1 -b:a 64k "${outputPath}"`;
  await runShell(cmd);

  // Probe duration
  try {
    const probeCmd = `ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${outputPath}"`;
    const { stdout } = await runShell(probeCmd);
    const duration = parseFloat(stdout.trim());
    return isNaN(duration) ? 0 : duration;
  } catch {
    return 0;
  }
}

/**
 * Core Gemini Transcription function
 */
async function transcribeAudioWithGemini(audioBuffer: Buffer, mimeType: string = 'audio/mp3', totalDurationSec: number = 0) {
  const base64Audio = audioBuffer.toString('base64');

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
Total estimated audio duration: ${totalDurationSec.toFixed(1)} seconds.
Output your analysis in structured JSON matching the provided schema.`;

  const audioPart = {
    inlineData: {
      mimeType: mimeType,
      data: base64Audio,
    },
  };

  if (!process.env.GEMINI_API_KEY) {
    throw new Error('GEMINI_API_KEY is not configured in the environment. Please configure your Gemini API Key in the Settings > Secrets panel in AI Studio.');
  }

  console.log(`[Gemini] Starting audio analysis, duration: ${totalDurationSec.toFixed(1)}s, payload size: ${(audioBuffer.length / 1024).toFixed(1)} KB...`);
  const startTime = Date.now();

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

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  const rawText = response.text;
  console.log(`[Gemini] Response received in ${elapsed}s, text length: ${rawText?.length || 0}`);
  if (!rawText) {
    const candidate = response.candidates?.[0];
    console.error('[Gemini] No text returned. Finish reason:', candidate?.finishReason);
    throw new Error(`Gemini generated an empty response (finishReason: ${candidate?.finishReason || 'unknown'}).`);
  }

  try {
    let clean = rawText.trim();
    if (clean.startsWith('```json')) {
      clean = clean.replace(/^```json\s*/, '').replace(/\s*```$/, '');
    } else if (clean.startsWith('```')) {
      clean = clean.replace(/^```\s*/, '').replace(/\s*```$/, '');
    }
    const parsed = JSON.parse(clean);
    console.log('[Gemini] Successfully parsed transcription with', parsed.lines?.length, 'lines.');
    return parsed;
  } catch (parseErr: any) {
    console.error('[Gemini] Failed to parse JSON:', parseErr.message, 'Raw text:', rawText.slice(0, 300));
    throw new Error(`Failed to parse structured lyrics JSON: ${parseErr.message}`);
  }
}

/**
 * POST /api/transcribe
 * Direct base64 audio transcription (compatible with Vercel and local Express)
 */
app.post('/api/transcribe', async (req: Request, res: Response) => {
  let tempRawPath = '';
  let tempCmpPath = '';
  try {
    const { audioBase64, mimeType = 'audio/mp3', duration = 0 } = req.body;
    if (!audioBase64) {
      res.status(400).json({ error: 'Missing audioBase64 in request body.' });
      return;
    }

    const base64Clean = audioBase64.replace(/^data:[^;]+;base64,/, '');
    const audioBuffer = Buffer.from(base64Clean, 'base64');

    // Save to temp file and downsample to 16kHz mono using FFmpeg for lightning-fast Gemini analysis
    const uniqueId = `b64_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    tempRawPath = path.join(UPLOADS_DIR, `${uniqueId}_raw.mp3`);
    tempCmpPath = path.join(UPLOADS_DIR, `${uniqueId}_cmp.mp3`);
    fs.writeFileSync(tempRawPath, audioBuffer);

    let processedBuffer = audioBuffer;
    let finalDuration = duration;
    try {
      finalDuration = await compressAudio(tempRawPath, tempCmpPath);
      processedBuffer = fs.readFileSync(tempCmpPath);
    } catch (cmpErr) {
      console.warn('FFmpeg compression skipped or failed, using raw buffer:', cmpErr);
    }

    const transcription = await transcribeAudioWithGemini(processedBuffer, 'audio/mp3', finalDuration);

    res.json({
      success: true,
      duration: finalDuration,
      transcription,
    });
  } catch (err: any) {
    console.error('Direct base64 transcription error:', err);
    res.status(500).json({
      error: err.message || 'Failed to transcribe audio.',
    });
  } finally {
    // Clean up temporary files
    if (tempRawPath && fs.existsSync(tempRawPath)) fs.unlink(tempRawPath, () => {});
    if (tempCmpPath && fs.existsSync(tempCmpPath)) fs.unlink(tempCmpPath, () => {});
  }
});

/**
 * POST /api/transcribe/upload
 * Handles uploaded audio file (MP3, WAV, M4A, etc.)
 */
app.post('/api/transcribe/upload', upload.single('audio'), async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      res.status(400).json({ error: 'No audio file provided.' });
      return;
    }

    const originalFilePath = req.file.path;
    const compressedFileName = `cmp_${path.basename(originalFilePath, path.extname(originalFilePath))}.mp3`;
    const compressedFilePath = path.join(UPLOADS_DIR, compressedFileName);

    // Compress with ffmpeg
    const duration = await compressAudio(originalFilePath, compressedFilePath);

    // Read audio buffer
    const audioBuffer = fs.readFileSync(compressedFilePath);

    // Call Gemini for transcription
    const transcription = await transcribeAudioWithGemini(audioBuffer, 'audio/mp3', duration);

    // Public URL for audio playback in frontend
    const audioUrl = `/uploads/${path.basename(originalFilePath)}`;

    res.json({
      success: true,
      audioUrl,
      duration,
      transcription,
    });
  } catch (err: any) {
    console.error('Upload transcription error:', err);
    let msg = err.message || 'Failed to transcribe uploaded audio.';
    if (msg.includes('403') || msg.includes('PERMISSION_DENIED') || msg.includes('SCOPE_INSUFFICIENT') || msg.includes('insufficient authentication')) {
      msg = 'Gemini API authentication failed (403: PERMISSION_DENIED). Please ensure a valid Gemini API key is selected in the Settings > Secrets panel in AI Studio.';
    } else if (msg.includes('timeout') || msg.includes('TIMED_OUT') || msg.includes('ETIMEDOUT')) {
      msg = 'Audio transcription timed out after 30 seconds. Please try a shorter track or verify your network connection.';
    }
    res.status(500).json({
      error: msg,
    });
  }
});

/**
 * GET /api/health
 */
app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    service: 'telugu-lyrics-transcriber',
    hasKey: !!process.env.GEMINI_API_KEY,
    keyPrefix: process.env.GEMINI_API_KEY ? process.env.GEMINI_API_KEY.substring(0, 4) + '...' : 'none',
  });
});

/**
 * Mount Vite in dev mode or serve static files in production
 */
async function startServer() {
  if (process.env.NODE_ENV === 'production') {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  } else {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server started on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Fatal server start error:', err);
});
