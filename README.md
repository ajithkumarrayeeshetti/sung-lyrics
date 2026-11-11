# Telugu & Multilingual Song Lyrics Transcriber

An AI-powered web application that transcribes sung lyrics in Telugu (and other Indian/global languages) into precise, synchronized, timestamped lyric tables using Google Gemini AI.

![Built with AI Studio](https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6)

## Features

- **Direct Audio File Upload**: Upload any `.mp3`, `.wav`, `.m4a`, `.aac`, `.flac`, `.ogg`, or `.webm` audio track.
- **Gemini AI Transcription**:
  - Exact Native Script (Telugu script)
  - Romanized Telugu transliteration
  - Microsecond-accurate start and end timestamps in `mm:ss.s` format
  - Automatic labeling of `[INSTRUMENTAL]` sections
  - Uncertain or muffled vocals marked as `[UNCLEAR]`
  - Contextual English translation & meaning
  - Word-by-word vocabulary breakdown
- **Interactive Audio Player**:
  - Live scrubber and bouncing waveform visualizer
  - Real-time row and karaoke highlighting as the audio plays
  - **Click-to-Seek**: Click any row to jump playback to that timestamp
  - **Line Looper**: Repeat any line continuously to practice pronunciation
  - **Speed Selector**: 0.75x, 1x, 1.25x
- **Multi-Song Library**: Automatically saves uploaded songs to browser storage.
- **Multiple Export Options**:
  - Copy formatted **Markdown Table**
  - Download **Plain Text (.TXT)**
  - Download Subtitles **(.SRT)**
  - Download Synced Karaoke Lyrics **(.LRC)**

## Deployment on Vercel

1. Push this repository to GitHub.
2. In Vercel, click **Import Project**. Vercel will automatically detect **Vite**.
3. Under **Environment Variables**, add:
   - `GEMINI_API_KEY`: Your Google Gemini API Key from [Google AI Studio](https://aistudio.google.com/apikey)
4. Click **Deploy**.

## Local Development

```bash
# Install dependencies
npm install

# Start development server
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.
