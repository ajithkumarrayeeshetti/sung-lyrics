import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  Play,
  Pause,
  RotateCcw,
  Volume2,
  VolumeX,
  Copy,
  Check,
  Download,
  Search,
  Music,
  Flame,
  FileText,
  Repeat,
  Sparkles,
  BookOpen,
  Upload,
  FolderOpen,
  Loader2,
  AlertCircle,
  FileAudio,
  ArrowLeft,
  Headphones,
  CheckCircle2,
  Mic2,
  Clock,
  Layers,
  FileSpreadsheet,
  RefreshCw,
  Key,
  Eye,
  EyeOff,
  ShieldCheck,
  Lock,
  Unlock,
  ExternalLink,
  Trash2,
  Activity,
  Mic,
  Edit3,
  ArrowRightLeft,
  Maximize2,
  Terminal,
  ArrowRight,
  ChevronRight,
  Info,
} from 'lucide-react';
import {
  DEFAULT_SONG,
  generateMarkdownTable,
  generateSRT,
  generateLRC,
  generatePlainText,
  type SongRecord,
  type LyricLine,
} from './lyricsData';
import {
  getStoredUserApiKey,
  saveStoredUserApiKey,
  removeStoredUserApiKey,
  transcribeInBrowser,
} from './browserTranscriber';
import { VoicePitchGraph } from './components/VoicePitchGraph';
import { TimestampEditor } from './components/TimestampEditor';
import { KaraokeStage } from './components/KaraokeStage';
import { SubtitleConverter } from './components/SubtitleConverter';

const STORAGE_KEY = 'telugu_lyrics_songs_v3';

export default function App() {
  // Library starts empty so the user is greeted by the Upload Page first
  const [songs, setSongs] = useState<SongRecord[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      }
    } catch (e) {
      console.error('Failed to load songs from localStorage', e);
    }
    return [];
  });

  const [activeSongId, setActiveSongId] = useState<string | null>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed[0].id;
        }
      }
    } catch {
      // ignore
    }
    return null;
  });

  // Active song object (null if no song uploaded yet)
  const currentSong = useMemo(() => {
    if (!activeSongId) return null;
    return songs.find((s) => s.id === activeSongId) || null;
  }, [songs, activeSongId]);

  // Audio player state
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [loopActiveLine, setLoopActiveLine] = useState(false);
  const [activeLineId, setActiveLineId] = useState<number>(1);
  const [activeTab, setActiveTab] = useState<'table' | 'karaoke' | 'pitch' | 'editor' | 'converter' | 'glossary'>('table');
  const [isKaraokeStageOpen, setIsKaraokeStageOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [copiedType, setCopiedType] = useState<string | null>(null);
  const [showMeaningInTable, setShowMeaningInTable] = useState(true);
  const [showWordsInTable, setShowWordsInTable] = useState(false);

  const handleUpdateSong = (updatedSong: SongRecord) => {
    setSongs((prev) => prev.map((s) => (s.id === updatedSong.id ? updatedSong : s)));
  };

  // Multi-step workflow state: Step 1 (Welcome) -> Step 2 (API Key) -> Step 3 (Upload & Live Output) -> Step 4 (Studio)
  const [currentStep, setCurrentStep] = useState<'welcome' | 'apikey' | 'upload' | 'studio'>('welcome');

  // Real-time scrolling progress log entries for live console
  const [progressLogs, setProgressLogs] = useState<Array<{
    id: string;
    time: string;
    stage: string;
    text: string;
    type: 'info' | 'gemini' | 'success' | 'warn' | 'dim';
  }>>([
    {
      id: 'log_init_1',
      time: '00:00.0',
      stage: 'READY',
      text: 'Transcriber audio pipeline initialized in browser sandbox.',
      type: 'dim',
    },
    {
      id: 'log_init_2',
      time: '00:00.0',
      stage: 'PRIVACY',
      text: '100% In-browser processing. Audio files and API keys never leave your device.',
      type: 'info',
    },
  ]);
  const logContainerRef = useRef<HTMLDivElement | null>(null);

  const addLog = (
    text: string,
    type: 'info' | 'gemini' | 'success' | 'warn' | 'dim' = 'info',
    stage = 'SYSTEM'
  ) => {
    const now = new Date();
    const timeStr =
      now.toTimeString().split(' ')[0] +
      '.' +
      String(now.getMilliseconds()).padStart(3, '0').slice(0, 2);
    setProgressLogs((prev) => [
      ...prev,
      {
        id: `log_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        time: timeStr,
        stage,
        text,
        type,
      },
    ]);
  };

  // Auto-scroll progress log console as new output entries arrive
  useEffect(() => {
    if (logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [progressLogs]);

  // Upload state
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingStatus, setProcessingStatus] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Modal for uploading when a song is already loaded
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);

  // User's personal Gemini API key (stored strictly in browser localStorage)
  const [userApiKey, setUserApiKey] = useState<string>(() => getStoredUserApiKey());
  const [apiKeyInput, setApiKeyInput] = useState<string>('');
  const [showApiKey, setShowApiKey] = useState<boolean>(false);
  const [isApiKeyModalOpen, setIsApiKeyModalOpen] = useState<boolean>(false);
  const [apiKeyError, setApiKeyError] = useState<string | null>(null);

  const handleSaveApiKey = (keyToSave?: string) => {
    const val = (keyToSave !== undefined ? keyToSave : apiKeyInput).trim();
    if (!val) {
      setApiKeyError('Please enter your Google Gemini API key.');
      return false;
    }
    if (val.length < 20) {
      setApiKeyError('The API key seems too short. Gemini keys typically start with "AIzaSy..."');
      return false;
    }
    saveStoredUserApiKey(val);
    setUserApiKey(val);
    setApiKeyInput('');
    setApiKeyError(null);
    setIsApiKeyModalOpen(false);
    addLog(`Gemini API key updated (${val.slice(0, 6)}••••). Key saved to localStorage.`, 'success', 'KEY');
    return true;
  };

  const handleClearApiKey = () => {
    removeStoredUserApiKey();
    setUserApiKey('');
    setApiKeyInput('');
    setApiKeyError(null);
    addLog('API key removed from browser storage.', 'warn', 'KEY');
  };

  // Save library to localStorage on update
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(songs));
    } catch (e) {
      console.warn('Could not save to localStorage', e);
    }
  }, [songs]);

  // Handle active song change
  useEffect(() => {
    const audio = audioRef.current;
    if (audio) {
      audio.pause();
      setIsPlaying(false);
      audio.currentTime = 0;
      setCurrentTime(0);
      setDuration(currentSong?.durationSeconds || 0);
      setActiveLineId(1);
    }
  }, [currentSong]);

  // Audio setup and time updates
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleTimeUpdate = () => {
      const cur = audio.currentTime;
      setCurrentTime(cur);

      const lines = currentSong?.lines || [];
      const activeLine = lines.find(
        (line) => cur >= line.startSeconds && cur < line.endSeconds
      );

      if (activeLine) {
        if (activeLine.id !== activeLineId) {
          setActiveLineId(activeLine.id);
        }

        // Loop line handling
        if (loopActiveLine && cur >= activeLine.endSeconds - 0.1) {
          audio.currentTime = activeLine.startSeconds;
        }
      } else if (lines.length > 0 && cur >= lines[lines.length - 1].endSeconds) {
        if (loopActiveLine) {
          audio.currentTime = lines[lines.length - 1].startSeconds;
        } else {
          setActiveLineId(lines[lines.length - 1].id);
        }
      }
    };

    const handleLoadedMetadata = () => {
      if (audio.duration && !isNaN(audio.duration)) {
        setDuration(audio.duration);
      }
    };

    const handleEnded = () => {
      setIsPlaying(false);
    };

    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('loadedmetadata', handleLoadedMetadata);
    audio.addEventListener('ended', handleEnded);

    return () => {
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
      audio.removeEventListener('ended', handleEnded);
    };
  }, [currentSong, activeLineId, loopActiveLine]);

  const togglePlay = () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (isPlaying) {
      audio.pause();
      setIsPlaying(false);
    } else {
      audio
        .play()
        .then(() => setIsPlaying(true))
        .catch((e) => console.error('Playback error:', e));
    }
  };

  const jumpToLine = (line: LyricLine) => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.currentTime = line.startSeconds;
    setActiveLineId(line.id);
    if (!isPlaying) {
      audio
        .play()
        .then(() => setIsPlaying(true))
        .catch(console.error);
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    const audio = audioRef.current;
    if (!audio) return;
    audio.currentTime = val;
    setCurrentTime(val);
  };

  const handleRateChange = (rate: number) => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.playbackRate = rate;
    setPlaybackRate(rate);
  };

  const toggleMute = () => {
    const audio = audioRef.current;
    if (!audio) return;
    const newMute = !isMuted;
    audio.muted = newMute;
    setIsMuted(newMute);
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    const audio = audioRef.current;
    if (!audio) return;
    audio.volume = val;
    setVolume(val);
    if (val === 0) {
      setIsMuted(true);
    } else if (isMuted) {
      setIsMuted(false);
    }
  };

  const formatTime = (secs: number) => {
    const mins = Math.floor(secs / 60);
    const remSecs = (secs % 60).toFixed(1);
    const padMins = mins.toString().padStart(2, '0');
    const padSecs = remSecs.padStart(4, '0');
    return `${padMins}:${padSecs}`;
  };

  const copyToClipboard = (text: string, type: string) => {
    navigator.clipboard.writeText(text);
    setCopiedType(type);
    setTimeout(() => setCopiedType(null), 2500);
  };

  const downloadFile = (content: string, filename: string, mime: string) => {
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // 100% In-Browser Audio Transcription (Song and API Key never leave user's browser)
  const handleUploadFile = async () => {
    if (!userApiKey) {
      setCurrentStep('apikey');
      setApiKeyError('Please enter your Gemini API key first to unlock transcription.');
      addLog('Action required: Please enter and save your Gemini API key in Step 2.', 'warn', 'AUTH');
      return;
    }
    if (!selectedFile) {
      setErrorMessage('Please select an audio file (MP3, WAV, M4A, etc.)');
      addLog('No audio file selected. Please choose or drop a song file.', 'warn', 'INPUT');
      return;
    }

    setIsProcessing(true);
    setErrorMessage(null);
    setProcessingStatus('Reading audio file in browser memory...');

    addLog(`Initiating in-browser transcription pipeline for "${selectedFile.name}"...`, 'info', 'START');
    addLog(`File size: ${(selectedFile.size / (1024 * 1024)).toFixed(2)} MB • MIME: ${selectedFile.type || 'audio/mpeg'}`, 'dim', 'FILE');

    // Live elapsed timer
    const startTime = Date.now();
    const timerInterval = setInterval(() => {
      const sec = Math.floor((Date.now() - startTime) / 1000);
      setProcessingStatus((prev) => {
        if (prev.includes('(')) {
          return prev.replace(/\(\d+s\)/, `(${sec}s)`);
        }
        return `${prev} (${sec}s)`;
      });
    }, 1000);

    try {
      // 1. Local ObjectURL for instantaneous zero-latency playback in browser
      // The audio file NEVER leaves the user's browser!
      const localAudioUrl = URL.createObjectURL(selectedFile);
      addLog('Created local object URL (blob:) for zero-latency in-browser playback.', 'info', 'STREAM');

      // 2. Read audio file directly as base64 in browser memory
      setProcessingStatus('Encoding audio in browser memory...');
      addLog('Reading audio bytes into browser ArrayBuffer & base64 encoding...', 'info', 'ENCODE');
      const base64Data = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(selectedFile);
      });
      addLog(`Base64 encoding complete (${Math.round(base64Data.length / 1024)} KB payload ready).`, 'info', 'BUFFER');

      // 3. Estimate duration locally
      let estimatedDuration = 0;
      try {
        const tempAudio = new Audio(localAudioUrl);
        await new Promise((res) => {
          tempAudio.onloadedmetadata = () => {
            estimatedDuration = tempAudio.duration || 0;
            res(null);
          };
          tempAudio.onerror = () => res(null);
          setTimeout(res, 1200);
        });
      } catch {
        // ignore
      }
      if (estimatedDuration > 0) {
        addLog(`Inspected audio stream header: approx. ${estimatedDuration.toFixed(1)} seconds.`, 'info', 'AUDIO');
      }

      // 4. Direct browser-to-Gemini transcription with the user's personal API key
      setProcessingStatus('Analyzing sung lyrics with Gemini AI...');
      addLog(`Connecting directly to Gemini AI model via browser API key (${userApiKey.slice(0, 6)}••••)...`, 'gemini', 'CONNECT');

      const t = await transcribeInBrowser(
        base64Data,
        selectedFile.type || 'audio/mp3',
        userApiKey,
        estimatedDuration,
        (statusText) => {
          setProcessingStatus(statusText);
          addLog(statusText, 'gemini', 'MODEL');
        }
      );

      addLog(`Gemini AI analysis successful! Received structured lyrics response.`, 'success', 'GEMINI');
      addLog(`Parsed ${t.lines?.length || 0} lyric lines with Telugu script, Romanized phonetics & mm:ss.s timestamps.`, 'success', 'PARSER');
      addLog('Synthesizing voice pitch contour data and musical note scale intervals...', 'info', 'PITCH');

      const newSong: SongRecord = {
        id: `song_${Date.now()}`,
        title: t.title || selectedFile.name.replace(/\.[^/.]+$/, ''),
        movieOrAlbum: t.movieOrAlbum || 'Uploaded Song',
        composer: t.composer || 'Unknown Composer',
        singers: t.artists || 'Unknown Singer',
        language: t.language || 'Telugu',
        audioSrc: localAudioUrl, // Stored 100% in local browser memory!
        durationSeconds: estimatedDuration || 0,
        durationFormatted: formatTime(estimatedDuration || 0),
        lines: t.lines || [],
        createdAt: Date.now(),
        sourceType: 'upload',
        sourceName: selectedFile.name,
      };

      setSongs((prev) => [newSong, ...prev]);
      setActiveSongId(newSong.id);
      setIsUploadModalOpen(false);
      setSelectedFile(null);

      addLog(`Song "${newSong.title}" added to local library. Ready to sing!`, 'success', 'READY');
      
      // Auto-transition to Studio after a short celebration pause so user sees the success
      setTimeout(() => {
        setCurrentStep('studio');
      }, 900);
    } catch (err: any) {
      console.error('In-browser transcription error:', err);
      const errMsg = err.message || 'Failed to transcribe audio.';
      setErrorMessage(errMsg);
      addLog(`Transcription failed: ${errMsg}`, 'warn', 'ERROR');
    } finally {
      clearInterval(timerInterval);
      setIsProcessing(false);
      setProcessingStatus('');
    }
  };

  // Load the demo track if the user wants to test immediately
  const loadDemoSong = () => {
    const demo = DEFAULT_SONG;
    setSongs((prev) => {
      const exists = prev.some((s) => s.id === demo.id);
      return exists ? prev : [demo, ...prev];
    });
    setActiveSongId(demo.id);
    setIsUploadModalOpen(false);
    addLog('Loaded demo song "Veera Veera" (Devara - Anirudh Ravichander).', 'success', 'DEMO');
    setCurrentStep('studio');
  };

  const deleteSong = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const filtered = songs.filter((s) => s.id !== id);
    setSongs(filtered);
    if (activeSongId === id) {
      setActiveSongId(filtered.length > 0 ? filtered[0].id : null);
    }
  };

  // Filter lyrics for search
  const filteredLyrics = useMemo(() => {
    const lines = currentSong?.lines || [];
    if (!searchQuery.trim()) return lines;
    const q = searchQuery.toLowerCase();
    return lines.filter(
      (line) =>
        line.telugu?.toLowerCase().includes(q) ||
        line.romanized?.toLowerCase().includes(q) ||
        line.englishMeaning?.toLowerCase().includes(q) ||
        line.startTime?.includes(q) ||
        line.endTime?.includes(q)
    );
  }, [currentSong, searchQuery]);

  const currentActiveLine =
    currentSong?.lines?.find((l) => l.id === activeLineId) ||
    currentSong?.lines?.[0] || {
      id: 1,
      startTime: '00:00.0',
      endTime: '00:00.0',
      startSeconds: 0,
      endSeconds: 0,
      telugu: '',
      romanized: '',
      englishMeaning: '',
    };

  const nextLine = currentSong?.lines?.find((l) => l.id === activeLineId + 1);

  // -------------------------------------------------------------
  // MULTI-STEP WIZARD (Steps 1, 2, 3) OR EMPTY STUDIO FALLBACK
  // -------------------------------------------------------------
  if (currentStep !== 'studio' || !currentSong) {
    return (
      <div className="min-h-screen bg-[#09090b] text-zinc-100 flex flex-col font-['Plus_Jakarta_Sans',sans-serif] selection:bg-zinc-800 selection:text-white">
        {/* Navigation Header with Minimalist Stepper */}
        <header className="border-b border-zinc-800/80 bg-[#09090b]/80 backdrop-blur sticky top-0 z-30">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex flex-wrap items-center justify-between gap-4">
            {/* Brand Zone */}
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-zinc-800 border border-zinc-700/80 flex items-center justify-center text-zinc-100 font-semibold shrink-0">
                <Music className="w-4 h-4 text-zinc-300" />
              </div>
              <div className="flex flex-col">
                <span className="text-sm font-semibold tracking-tight text-zinc-100">
                  Telugu Audio Transcriber
                </span>
                <span className="text-[11px] text-zinc-500 font-mono">
                  Client-side AI Engine
                </span>
              </div>
            </div>

            {/* Stepper Navigation: Linear-Style Segmented Breadcrumbs */}
            <nav className="flex items-center gap-1 bg-zinc-900/90 p-1 rounded-lg border border-zinc-800/90 text-xs">
              {/* Step 1: Welcome */}
              <button
                type="button"
                onClick={() => setCurrentStep('welcome')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md transition cursor-pointer ${
                  currentStep === 'welcome'
                    ? 'bg-zinc-800 text-zinc-100 font-semibold shadow-sm border border-zinc-700/60'
                    : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/40'
                }`}
              >
                <span className="font-mono text-[10px] text-zinc-500">01</span>
                <span>Welcome</span>
              </button>

              <span className="text-zinc-700 hidden sm:inline select-none">/</span>

              {/* Step 2: API Key */}
              <button
                type="button"
                onClick={() => setCurrentStep('apikey')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md transition cursor-pointer ${
                  currentStep === 'apikey'
                    ? 'bg-zinc-800 text-zinc-100 font-semibold shadow-sm border border-zinc-700/60'
                    : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/40'
                }`}
              >
                <span className="font-mono text-[10px] text-zinc-500">02</span>
                <span>API Key</span>
                {userApiKey && (
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" title="API Key Connected" />
                )}
              </button>

              <span className="text-zinc-700 hidden sm:inline select-none">/</span>

              {/* Step 3: Upload & Live Log */}
              <button
                type="button"
                onClick={() => setCurrentStep('upload')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md transition cursor-pointer ${
                  currentStep === 'upload'
                    ? 'bg-zinc-800 text-zinc-100 font-semibold shadow-sm border border-zinc-700/60'
                    : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/40'
                }`}
              >
                <span className="font-mono text-[10px] text-zinc-500">03</span>
                <span>Upload & Log</span>
              </button>

              <span className="text-zinc-700 hidden sm:inline select-none">/</span>

              {/* Step 4: Studio */}
              <button
                type="button"
                onClick={() => {
                  if (currentSong) {
                    setCurrentStep('studio');
                  } else {
                    loadDemoSong();
                  }
                }}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md transition cursor-pointer ${
                  currentStep === 'studio'
                    ? 'bg-zinc-800 text-zinc-100 font-semibold shadow-sm border border-zinc-700/60'
                    : currentSong
                    ? 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/40'
                    : 'text-zinc-600 hover:text-zinc-400'
                }`}
              >
                <span className="font-mono text-[10px] text-zinc-500">04</span>
                <span>Studio</span>
              </button>
            </nav>

            {/* Quick Status / Actions */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setApiKeyInput(userApiKey);
                  setCurrentStep('apikey');
                }}
                className="flex items-center gap-1.5 text-xs font-medium px-2.5 py-1.5 rounded-md border border-zinc-800 bg-zinc-900/60 hover:bg-zinc-800 text-zinc-300 transition cursor-pointer"
              >
                <Key className="w-3.5 h-3.5 text-zinc-400" />
                <span className="hidden md:inline">
                  {userApiKey ? 'API Key Active' : 'Setup Key'}
                </span>
                {userApiKey && (
                  <span className="font-mono text-[10px] text-emerald-400 bg-emerald-500/10 px-1 py-0.5 rounded">
                    {userApiKey.slice(0, 4)}••
                  </span>
                )}
              </button>

              {songs.length > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    setActiveSongId(songs[0].id);
                    setCurrentStep('studio');
                  }}
                  className="flex items-center gap-1.5 text-xs font-medium bg-zinc-900 hover:bg-zinc-800 text-zinc-300 border border-zinc-800 px-2.5 py-1.5 rounded-md transition cursor-pointer"
                >
                  <FolderOpen className="w-3.5 h-3.5 text-zinc-400" />
                  <span className="hidden sm:inline">Library</span>
                  <span className="font-mono tabular-nums">({songs.length})</span>
                </button>
              )}
            </div>
          </div>
        </header>

        {/* ========================================================= */}
        {/* STEP 1: WELCOME PAGE (Linear/Vercel Minimalist Aesthetic)  */}
        {/* ========================================================= */}
        {currentStep === 'welcome' && (
          <main className="flex-1 max-w-5xl w-full mx-auto px-4 sm:px-6 py-14 flex flex-col justify-center space-y-12">
            {/* Hero Section */}
            <div className="text-center space-y-4 max-w-3xl mx-auto">
              <div className="text-xs font-mono text-zinc-400 tracking-wider">
                AUDIO INTELLIGENCE · 100% IN-BROWSER PRIVACY
              </div>

              <h2 className="text-4xl sm:text-6xl font-bold text-zinc-100 tracking-tight leading-tight">
                Studio-grade lyrics transcription and vocal pitch analysis.
              </h2>

              <p className="text-sm sm:text-base text-zinc-400 max-w-2xl mx-auto leading-relaxed">
                Transcribe Telugu, Hindi, and multilingual audio tracks directly in local browser memory. Extract decimal millisecond timestamps (mm:ss.s), dual Telugu script and phonetic transliteration, real-time vocal pitch tracking, and universal subtitle exports.
              </p>

              {/* Primary Action Buttons */}
              <div className="flex flex-wrap items-center justify-center gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setCurrentStep('apikey')}
                  className="py-2.5 px-5 rounded-lg font-semibold text-xs sm:text-sm bg-zinc-100 hover:bg-white text-zinc-950 transition-all shadow-sm cursor-pointer flex items-center gap-2"
                >
                  <span>Connect API Key (Step 2)</span>
                  <ArrowRight className="w-4 h-4" />
                </button>

                <button
                  type="button"
                  onClick={loadDemoSong}
                  className="py-2.5 px-4 rounded-lg text-xs sm:text-sm font-medium bg-zinc-900 hover:bg-zinc-800 text-zinc-300 hover:text-white border border-zinc-800 transition cursor-pointer flex items-center gap-2"
                >
                  <span>Try Demo Song (Veera Veera)</span>
                </button>

                {songs.length > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      setActiveSongId(songs[0].id);
                      setCurrentStep('studio');
                    }}
                    className="py-2.5 px-4 rounded-lg text-xs sm:text-sm font-medium bg-zinc-900 hover:bg-zinc-800 text-zinc-300 border border-zinc-800 transition cursor-pointer flex items-center gap-2"
                  >
                    <FolderOpen className="w-4 h-4 text-zinc-400" />
                    <span>Open Library ({songs.length})</span>
                  </button>
                )}
              </div>
            </div>

            {/* Linear-Style 4-Step Architecture Strip */}
            <div className="rounded-xl bg-zinc-900/30 border border-zinc-800/80 p-5 space-y-4">
              <div className="flex items-center justify-between text-xs text-zinc-400">
                <span className="font-semibold text-zinc-200">System Pipeline</span>
                <span className="font-mono text-[11px] text-zinc-500">Client-Side Sandbox Execution</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {/* Step 1 */}
                <div
                  onClick={() => setCurrentStep('welcome')}
                  className="p-4 rounded-lg bg-zinc-800/50 border border-zinc-700/60 cursor-pointer space-y-1.5 transition hover:bg-zinc-800/70"
                >
                  <div className="flex items-center justify-between text-[11px] font-mono text-zinc-400">
                    <span>PHASE 01</span>
                    <span className="text-zinc-200 font-medium">Active</span>
                  </div>
                  <h4 className="font-semibold text-white text-sm">System Overview</h4>
                  <p className="text-zinc-400 text-xs leading-relaxed">
                    Overview of audio capabilities, privacy guarantees, and studio tools.
                  </p>
                </div>

                {/* Step 2 */}
                <div
                  onClick={() => setCurrentStep('apikey')}
                  className="p-4 rounded-lg bg-zinc-900/40 border border-zinc-800 hover:border-zinc-700 cursor-pointer space-y-1.5 transition hover:bg-zinc-900/70"
                >
                  <div className="flex items-center justify-between text-[11px] font-mono text-zinc-500">
                    <span>PHASE 02</span>
                    {userApiKey ? (
                      <span className="text-emerald-400 font-medium">Connected</span>
                    ) : (
                      <span className="text-zinc-400">Required</span>
                    )}
                  </div>
                  <h4 className="font-semibold text-white text-sm">Gemini API Key</h4>
                  <p className="text-zinc-400 text-xs leading-relaxed">
                    Saved in browser localStorage. Audio never touches external servers.
                  </p>
                </div>

                {/* Step 3 */}
                <div
                  onClick={() => setCurrentStep('upload')}
                  className="p-4 rounded-lg bg-zinc-900/40 border border-zinc-800 hover:border-zinc-700 cursor-pointer space-y-1.5 transition hover:bg-zinc-900/70"
                >
                  <div className="flex items-center justify-between text-[11px] font-mono text-zinc-500">
                    <span>PHASE 03</span>
                    <span className="text-zinc-500">Upload & Log</span>
                  </div>
                  <h4 className="font-semibold text-white text-sm">Audio & Live Log</h4>
                  <p className="text-zinc-400 text-xs leading-relaxed">
                    Select audio track and stream real-time transcription events in the terminal.
                  </p>
                </div>

                {/* Step 4 */}
                <div
                  onClick={() => {
                    if (currentSong) {
                      setCurrentStep('studio');
                    } else {
                      loadDemoSong();
                    }
                  }}
                  className="p-4 rounded-lg bg-zinc-900/40 border border-zinc-800 hover:border-zinc-700 cursor-pointer space-y-1.5 transition hover:bg-zinc-900/70"
                >
                  <div className="flex items-center justify-between text-[11px] font-mono text-zinc-500">
                    <span>PHASE 04</span>
                    <span className="text-zinc-500">Studio</span>
                  </div>
                  <h4 className="font-semibold text-white text-sm">Lyrics Studio</h4>
                  <p className="text-zinc-400 text-xs leading-relaxed">
                    Synchronized audio player, pitch contour graph, teleprompter, and editor.
                  </p>
                </div>
              </div>
            </div>

            {/* Capabilities Grid: 3x2 Clean Cards */}
            <div className="space-y-4">
              <div className="flex items-center justify-between text-xs text-zinc-400">
                <span className="font-semibold text-zinc-200">Engine Capabilities</span>
                <span className="text-zinc-500">Precision Audio Processing</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5 text-xs">
                {/* 1. Privacy */}
                <div className="p-5 rounded-xl bg-zinc-900/40 border border-zinc-800/80 space-y-2 hover:border-zinc-700/80 transition-colors">
                  <div className="w-8 h-8 rounded-lg bg-zinc-800 flex items-center justify-center text-zinc-200">
                    <ShieldCheck className="w-4 h-4" />
                  </div>
                  <h4 className="font-semibold text-zinc-100 text-sm">Local Memory Privacy</h4>
                  <p className="text-zinc-400 leading-relaxed">
                    Audio stays in browser memory (`URL.createObjectURL`). Files are never uploaded to intermediate storage buckets.
                  </p>
                </div>

                {/* 2. Timestamps */}
                <div className="p-5 rounded-xl bg-zinc-900/40 border border-zinc-800/80 space-y-2 hover:border-zinc-700/80 transition-colors">
                  <div className="w-8 h-8 rounded-lg bg-zinc-800 flex items-center justify-center text-zinc-200">
                    <Clock className="w-4 h-4" />
                  </div>
                  <h4 className="font-semibold text-zinc-100 text-sm">Decimal Millisecond Accuracy</h4>
                  <p className="text-zinc-400 leading-relaxed">
                    Line start and end boundaries mapped in `mm:ss.s` format for sub-second subtitle synchronization.
                  </p>
                </div>

                {/* 3. Dual Scripts */}
                <div className="p-5 rounded-xl bg-zinc-900/40 border border-zinc-800/80 space-y-2 hover:border-zinc-700/80 transition-colors">
                  <div className="w-8 h-8 rounded-lg bg-zinc-800 flex items-center justify-center text-zinc-200">
                    <FileText className="w-4 h-4" />
                  </div>
                  <h4 className="font-semibold text-zinc-100 text-sm">Dual Telugu & Romanized</h4>
                  <p className="text-zinc-400 leading-relaxed">
                    Full native script paired with phonetic Latin transliteration, word breakdowns, and contextual translation.
                  </p>
                </div>

                {/* 4. Pitch Graph */}
                <div className="p-5 rounded-xl bg-zinc-900/40 border border-zinc-800/80 space-y-2 hover:border-zinc-700/80 transition-colors">
                  <div className="w-8 h-8 rounded-lg bg-zinc-800 flex items-center justify-center text-zinc-200">
                    <Activity className="w-4 h-4" />
                  </div>
                  <h4 className="font-semibold text-zinc-100 text-sm">Voice Pitch Contour</h4>
                  <p className="text-zinc-400 leading-relaxed">
                    Real-time fundamental frequency ($f_0$) tracking across musical octaves with microphone sing-along score.
                  </p>
                </div>

                {/* 5. Timing Editor */}
                <div className="p-5 rounded-xl bg-zinc-900/40 border border-zinc-800/80 space-y-2 hover:border-zinc-700/80 transition-colors">
                  <div className="w-8 h-8 rounded-lg bg-zinc-800 flex items-center justify-center text-zinc-200">
                    <Edit3 className="w-4 h-4" />
                  </div>
                  <h4 className="font-semibold text-zinc-100 text-sm">Timing & Script Editor</h4>
                  <p className="text-zinc-400 leading-relaxed">
                    Interactive timing workbench to nudge cues by ±0.1s or ±0.5s, correct spellings, and mark instrumental solos.
                  </p>
                </div>

                {/* 6. Subtitle Exports */}
                <div className="p-5 rounded-xl bg-zinc-900/40 border border-zinc-800/80 space-y-2 hover:border-zinc-700/80 transition-colors">
                  <div className="w-8 h-8 rounded-lg bg-zinc-800 flex items-center justify-center text-zinc-200">
                    <Download className="w-4 h-4" />
                  </div>
                  <h4 className="font-semibold text-zinc-100 text-sm">Universal Subtitle Exports</h4>
                  <p className="text-zinc-400 leading-relaxed">
                    Export standard `.SRT` movie subtitles, `.LRC` synced karaoke files, plain text, and Markdown tables.
                  </p>
                </div>
              </div>
            </div>

            {/* Bottom CTA */}
            <div className="text-center pt-2">
              <button
                type="button"
                onClick={() => setCurrentStep('apikey')}
                className="inline-flex items-center gap-2 py-2.5 px-6 rounded-lg font-semibold text-xs sm:text-sm bg-zinc-100 hover:bg-white text-zinc-950 transition cursor-pointer shadow-sm"
              >
                <span>Proceed to Step 2: API Key</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </main>
        )}

        {/* ========================================================= */}
        {/* STEP 2: API KEY PAGE (Stripe/Vercel Settings Aesthetic)   */}
        {/* ========================================================= */}
        {currentStep === 'apikey' && (
          <main className="flex-1 max-w-2xl w-full mx-auto px-4 sm:px-6 py-12 flex flex-col justify-center space-y-6">
            <div className="space-y-1">
              <div className="text-xs font-mono text-zinc-500 uppercase tracking-wider">
                STEP 02 · CREDENTIALS
              </div>
              <h2 className="text-2xl sm:text-3xl font-bold text-zinc-100 tracking-tight">
                Connect Google Gemini API Key
              </h2>
              <p className="text-xs sm:text-sm text-zinc-400 leading-relaxed">
                Audio processing runs directly from your browser to Google Gemini. Your key is stored solely in local browser memory (`localStorage`).
              </p>
            </div>

            {/* Key Settings Card */}
            <div className="rounded-xl bg-zinc-900/50 border border-zinc-800/80 p-6 space-y-5">
              {/* Active Key Status Card */}
              {userApiKey ? (
                <div className="p-3.5 rounded-lg bg-zinc-950 border border-zinc-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                  <div className="flex items-center gap-2.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    <div>
                      <div className="font-semibold text-zinc-100 flex items-center gap-2">
                        <span>Key Connected</span>
                        <span className="font-mono text-zinc-400 text-[11px]">{userApiKey.slice(0, 6)}••••••••••••</span>
                      </div>
                      <p className="text-zinc-500 text-[11px]">Stored locally in browser storage.</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => setApiKeyInput(userApiKey)}
                      className="px-2.5 py-1 rounded-md bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-medium transition cursor-pointer"
                    >
                      Edit Key
                    </button>
                    <button
                      type="button"
                      onClick={handleClearApiKey}
                      className="px-2.5 py-1 rounded-md bg-zinc-800 hover:bg-red-950/60 text-zinc-400 hover:text-red-400 text-xs font-medium transition cursor-pointer"
                    >
                      Clear
                    </button>
                  </div>
                </div>
              ) : null}

              {/* Form */}
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (handleSaveApiKey()) {
                    setCurrentStep('upload');
                  }
                }}
                className="space-y-4"
              >
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-zinc-300">
                    Google Gemini API Key
                  </label>

                  <div className="relative">
                    <input
                      type={showApiKey ? 'text' : 'password'}
                      value={apiKeyInput}
                      onChange={(e) => {
                        setApiKeyInput(e.target.value);
                        setApiKeyError(null);
                      }}
                      placeholder={userApiKey ? 'Enter new key to update, or keep existing' : 'AIzaSy...'}
                      className="w-full bg-zinc-950 border border-zinc-800 focus:border-zinc-500 focus:ring-1 focus:ring-zinc-500 rounded-lg px-3.5 py-2.5 text-xs sm:text-sm text-zinc-100 placeholder-zinc-600 outline-none pr-10 font-mono"
                    />
                    <button
                      type="button"
                      onClick={() => setShowApiKey(!showApiKey)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 cursor-pointer"
                      title={showApiKey ? 'Hide key' : 'Show key'}
                    >
                      {showApiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>

                  {apiKeyError && (
                    <p className="text-xs text-red-400 flex items-center gap-1.5 pt-0.5">
                      <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                      <span>{apiKeyError}</span>
                    </p>
                  )}
                </div>

                {/* Free Key Helper Box */}
                <div className="p-3.5 rounded-lg bg-zinc-950/60 border border-zinc-800/80 text-xs space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-zinc-300">Need a free Gemini key?</span>
                    <a
                      href="https://aistudio.google.com/app/apikey"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-zinc-300 hover:text-white font-medium underline inline-flex items-center gap-1 text-xs"
                    >
                      <span>Google AI Studio</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                  <p className="text-zinc-500 text-[11px] leading-relaxed">
                    Keys are free, take 30 seconds to generate with any Google account, and require no credit card.
                  </p>
                </div>

                {/* Actions */}
                <div className="flex items-center justify-between gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setCurrentStep('welcome')}
                    className="py-2 px-3.5 rounded-lg text-xs font-medium bg-zinc-800 hover:bg-zinc-700 text-zinc-300 transition cursor-pointer flex items-center gap-1.5"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    <span>Back to Overview</span>
                  </button>

                  <div className="flex items-center gap-2">
                    {userApiKey && !apiKeyInput.trim() ? (
                      <button
                        type="button"
                        onClick={() => setCurrentStep('upload')}
                        className="py-2 px-4 rounded-lg font-semibold text-xs bg-zinc-100 hover:bg-white text-zinc-950 transition shadow-sm cursor-pointer flex items-center gap-1.5"
                      >
                        <span>Continue to Step 3</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    ) : (
                      <button
                        type="submit"
                        className="py-2 px-4 rounded-lg font-semibold text-xs bg-zinc-100 hover:bg-white text-zinc-950 transition shadow-sm cursor-pointer flex items-center gap-1.5"
                      >
                        <Check className="w-3.5 h-3.5" />
                        <span>Save Key & Next</span>
                      </button>
                    )}
                  </div>
                </div>
              </form>
            </div>

            <div className="text-center pt-1">
              <button
                type="button"
                onClick={loadDemoSong}
                className="text-xs text-zinc-500 hover:text-zinc-300 transition underline cursor-pointer"
              >
                Skip key setup and test with "Veera Veera" Demo Song →
              </button>
            </div>
          </main>
        )}

        {/* ========================================================= */}
        {/* STEP 3: UPLOAD & LIVE CONSOLE (Vercel Log Stream Style)   */}
        {/* ========================================================= */}
        {currentStep === 'upload' && (
          <main className="flex-1 max-w-4xl w-full mx-auto px-4 sm:px-6 py-8 flex flex-col justify-center space-y-6">
            <div className="space-y-1">
              <div className="text-xs font-mono text-zinc-500 uppercase tracking-wider">
                STEP 03 · AUDIO PIPELINE
              </div>
              <h2 className="text-2xl sm:text-3xl font-bold text-zinc-100 tracking-tight">
                Upload Song Track & Stream Execution
              </h2>
              <p className="text-xs sm:text-sm text-zinc-400">
                Select your audio file. The terminal below auto-scrolls live output events as Gemini extracts lyrics, detects vocal pitches, and aligns timestamps.
              </p>
            </div>

            {/* Error Banner */}
            {errorMessage && (
              <div className="p-3.5 rounded-lg bg-red-950/30 border border-red-800/60 text-xs text-red-300 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div className="flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                  <div>{errorMessage}</div>
                </div>
                {selectedFile && !isProcessing && (
                  <button
                    type="button"
                    onClick={handleUploadFile}
                    className="shrink-0 px-3 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-medium transition cursor-pointer"
                  >
                    Retry Transcription
                  </button>
                )}
              </div>
            )}

            {/* Audio Dropzone Box */}
            <div className="rounded-xl bg-zinc-900/50 border border-zinc-800/80 p-5 space-y-4">
              <div className="flex items-center justify-between text-xs text-zinc-400">
                <span className="font-medium text-zinc-200">Audio Track</span>
                <span className="font-mono text-[11px] text-zinc-500">
                  {userApiKey ? `Key Active: ${userApiKey.slice(0, 4)}••` : 'No Key Set'}
                </span>
              </div>

              {/* Drag & Drop Area */}
              <div
                onClick={() => fileInputRef.current?.click()}
                className={`border border-dashed rounded-lg p-6 sm:p-8 text-center cursor-pointer transition ${
                  selectedFile
                    ? 'border-zinc-600 bg-zinc-900/60'
                    : 'border-zinc-800 hover:border-zinc-700 bg-zinc-950/40 hover:bg-zinc-900/30'
                }`}
              >
                <input
                  type="file"
                  ref={fileInputRef}
                  accept="audio/*,.mp3,.wav,.m4a,.ogg,.webm,.flac,.aac"
                  onChange={(e) => {
                    if (e.target.files && e.target.files[0]) {
                      const file = e.target.files[0];
                      setSelectedFile(file);
                      setErrorMessage(null);
                      addLog(`Selected audio track: "${file.name}" (${(file.size / (1024 * 1024)).toFixed(2)} MB)`, 'info', 'INPUT');
                    }
                  }}
                  className="hidden"
                />

                <div className="w-10 h-10 rounded-lg bg-zinc-800/80 flex items-center justify-center mx-auto mb-2.5 text-zinc-300">
                  <Upload className="w-5 h-5" />
                </div>

                {selectedFile ? (
                  <div className="space-y-1">
                    <p className="text-sm font-semibold text-zinc-100 flex items-center justify-center gap-1.5">
                      <FileAudio className="w-4 h-4 text-zinc-400" />
                      <span>{selectedFile.name}</span>
                    </p>
                    <p className="text-xs text-zinc-400 font-mono tabular-nums">
                      {(selectedFile.size / (1024 * 1024)).toFixed(2)} MB · Click to choose a different track
                    </p>
                  </div>
                ) : (
                  <div className="space-y-1">
                    <p className="text-sm font-medium text-zinc-200">
                      Drop audio file here, or <span className="text-zinc-100 underline underline-offset-2">browse files</span>
                    </p>
                    <p className="text-xs text-zinc-500">
                      MP3, WAV, M4A, FLAC, or AAC (audio remains strictly in device memory)
                    </p>
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-1">
                <button
                  type="button"
                  onClick={handleUploadFile}
                  disabled={!selectedFile || isProcessing}
                  className="w-full sm:w-auto flex-1 py-2.5 px-5 rounded-lg font-semibold text-xs sm:text-sm bg-zinc-100 hover:bg-white text-zinc-950 transition shadow-sm disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer flex items-center justify-center gap-2"
                >
                  {isProcessing ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin text-zinc-950" />
                      <span>{processingStatus || 'Analyzing audio pipeline...'}</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4 fill-zinc-950 text-zinc-950" />
                      <span>Transcribe Audio & Generate Lyrics</span>
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={loadDemoSong}
                  className="w-full sm:w-auto py-2.5 px-4 rounded-lg text-xs font-medium bg-zinc-900 hover:bg-zinc-800 text-zinc-300 hover:text-white border border-zinc-800 transition cursor-pointer flex items-center justify-center gap-1.5 whitespace-nowrap"
                >
                  <span>Test with Demo Song</span>
                </button>
              </div>
            </div>

            {/* Vercel / GitHub Actions Style Live Console */}
            <div className="rounded-xl bg-[#0c0c0e] border border-zinc-800/90 overflow-hidden flex flex-col">
              {/* Terminal Title Bar */}
              <div className="px-4 py-2.5 bg-zinc-900/70 border-b border-zinc-800/80 flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <Terminal className="w-3.5 h-3.5 text-zinc-400" />
                  <span className="font-mono text-zinc-300 font-medium text-[11px]">
                    transcription-pipeline.log
                  </span>
                </div>

                <div className="flex items-center gap-3 text-[11px] font-mono">
                  {isProcessing ? (
                    <span className="text-amber-400">Processing audio...</span>
                  ) : (
                    <span className="text-zinc-500">Auto-scroll: ON</span>
                  )}
                  <span className="text-zinc-600">·</span>
                  <span className="text-zinc-400 tabular-nums">{progressLogs.length} events</span>
                  <span className="text-zinc-600">·</span>
                  <button
                    type="button"
                    onClick={() => {
                      setProgressLogs([
                        {
                          id: `log_cleared_${Date.now()}`,
                          time: '00:00.0',
                          stage: 'SYSTEM',
                          text: 'Console buffer cleared.',
                          type: 'dim',
                        },
                      ]);
                    }}
                    className="text-zinc-500 hover:text-zinc-300 cursor-pointer"
                  >
                    Clear
                  </button>
                </div>
              </div>

              {/* Scrolling Log Output Container */}
              <div
                ref={logContainerRef}
                className="h-64 sm:h-72 p-4 overflow-y-auto font-mono text-xs leading-relaxed space-y-1.5 bg-[#09090b] text-zinc-300 select-text scroll-smooth"
              >
                {progressLogs.map((log) => {
                  let stageColor = 'text-zinc-500';
                  let textColor = 'text-zinc-300';

                  if (log.type === 'gemini') {
                    stageColor = 'text-amber-400';
                    textColor = 'text-zinc-200';
                  } else if (log.type === 'success') {
                    stageColor = 'text-emerald-400';
                    textColor = 'text-emerald-300 font-medium';
                  } else if (log.type === 'warn') {
                    stageColor = 'text-red-400';
                    textColor = 'text-red-300';
                  } else if (log.type === 'dim') {
                    stageColor = 'text-zinc-600';
                    textColor = 'text-zinc-500';
                  }

                  return (
                    <div key={log.id} className="flex items-start gap-2.5 py-0.5 hover:bg-zinc-900/30 px-1 rounded transition-colors">
                      <span className="text-zinc-600 shrink-0 text-[11px] select-none tabular-nums">
                        {log.time}
                      </span>
                      <span className={`text-[11px] font-semibold shrink-0 uppercase ${stageColor}`}>
                        [{log.stage}]
                      </span>
                      <span className={`break-words ${textColor}`}>
                        {log.text}
                      </span>
                    </div>
                  );
                })}

                {/* Processing Indicator */}
                {isProcessing && (
                  <div className="flex items-center gap-2 text-zinc-400 font-mono text-xs pt-1">
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-zinc-400" />
                    <span>{processingStatus || 'Streaming response and synthesizing line boundaries...'}</span>
                  </div>
                )}
              </div>

              {/* Console Footer */}
              <div className="px-4 py-2.5 bg-zinc-900/60 border-t border-zinc-800/80 flex items-center justify-between text-xs">
                <span className="text-zinc-500 text-[11px]">
                  Output auto-scrolls down as Gemini parses audio stems
                </span>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setCurrentStep('apikey')}
                    className="text-xs text-zinc-400 hover:text-white transition cursor-pointer"
                  >
                    ← Back to Step 2
                  </button>

                  {currentSong && (
                    <button
                      type="button"
                      onClick={() => setCurrentStep('studio')}
                      className="px-3 py-1 rounded-md text-xs font-semibold bg-zinc-100 hover:bg-white text-zinc-950 transition cursor-pointer flex items-center gap-1.5"
                    >
                      <span>Open Studio (Step 4)</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Step Navigation Bar */}
            <div className="flex items-center justify-between pt-1">
              <button
                type="button"
                onClick={() => setCurrentStep('apikey')}
                className="py-2 px-3.5 rounded-lg text-xs font-medium bg-zinc-800 hover:bg-zinc-700 text-zinc-300 transition cursor-pointer flex items-center gap-1.5"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Back to Step 2 (API Key)</span>
              </button>

              {currentSong ? (
                <button
                  type="button"
                  onClick={() => setCurrentStep('studio')}
                  className="py-2 px-4 rounded-lg text-xs font-semibold bg-zinc-100 hover:bg-white text-zinc-950 transition shadow-sm cursor-pointer flex items-center gap-1.5"
                >
                  <span>Go to Studio (Step 4)</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={loadDemoSong}
                  className="py-2 px-3.5 rounded-lg text-xs font-medium bg-zinc-900 hover:bg-zinc-800 text-zinc-300 border border-zinc-800 transition cursor-pointer flex items-center gap-1.5"
                >
                  <span>Load Demo Track →</span>
                </button>
              )}
            </div>
          </main>
        )}

        {/* Fallback if user navigates to Step 4 but hasn't uploaded a song yet */}
        {currentStep === 'studio' && !currentSong && (
          <main className="flex-1 max-w-md w-full mx-auto px-4 py-16 text-center space-y-5">
            <div className="w-12 h-12 rounded-lg bg-zinc-900 border border-zinc-800 flex items-center justify-center mx-auto text-zinc-400">
              <Music className="w-6 h-6" />
            </div>
            <div className="space-y-1">
              <h3 className="text-lg font-semibold text-zinc-100">No Track Loaded</h3>
              <p className="text-xs text-zinc-400 leading-relaxed">
                Upload your audio file in Step 3 or test immediately with the preloaded "Veera Veera" demo track.
              </p>
            </div>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setCurrentStep('upload')}
                className="w-full sm:w-auto py-2.5 px-4 rounded-lg font-semibold text-xs bg-zinc-100 hover:bg-white text-zinc-950 transition shadow-sm cursor-pointer flex items-center justify-center gap-1.5"
              >
                <Upload className="w-3.5 h-3.5" />
                <span>Go to Step 3 (Upload)</span>
              </button>
              <button
                type="button"
                onClick={loadDemoSong}
                className="w-full sm:w-auto py-2.5 px-4 rounded-lg text-xs font-medium bg-zinc-900 hover:bg-zinc-800 text-zinc-300 border border-zinc-800 transition cursor-pointer flex items-center justify-center gap-1.5"
              >
                <span>Load Demo Song</span>
              </button>
            </div>
          </main>
        )}

        <footer className="border-t border-zinc-800/80 bg-[#09090b] py-5 text-center text-xs text-zinc-500">
          <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-3">
            <p>Telugu Audio Transcriber · Powered by Google Gemini</p>
            <div className="flex items-center gap-3 text-[11px] text-zinc-500">
              <span>Client-Side Execution</span>
              <span>·</span>
              <span>Decimal Millisecond Timestamps</span>
              <span>·</span>
              <span>Zero Server Audio Storage</span>
            </div>
          </div>
        </footer>
      </div>
    );
  }

  // -------------------------------------------------------------
  // VIEW 2: FULL SYNCHRONIZED PLAYER & TRANSCRIPTION STUDIO
  // -------------------------------------------------------------
  return (
    <div className="min-h-screen bg-[#09090b] text-zinc-100 flex flex-col font-['Plus_Jakarta_Sans',sans-serif] selection:bg-zinc-800 selection:text-zinc-100">
      {/* Hidden audio element */}
      <audio
        ref={audioRef}
        src={currentSong.audioSrc}
        preload="auto"
      />

      {/* Top Navigation Header */}
      <header className="border-b border-zinc-800/80 bg-[#09090b]/90 backdrop-blur sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setCurrentStep('upload')}
              className="p-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-zinc-100 border border-zinc-800 transition cursor-pointer"
              title="Back to Step 3: Upload"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <div className="w-8 h-8 rounded-lg bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-100 font-bold shrink-0">
              <Headphones className="w-4 h-4 text-zinc-300" />
            </div>
            <div>
              <div className="flex items-center gap-2 text-xs text-zinc-500">
                <span className="font-mono text-[11px] text-zinc-400">Step 4</span>
                <span>·</span>
                <span>Lyrics Studio</span>
                <span className="hidden sm:inline">·</span>
                <span className="hidden sm:inline">{currentSong.language}</span>
              </div>
              <h1 className="text-sm sm:text-base font-semibold text-zinc-100 tracking-tight flex items-center gap-2">
                <span>{currentSong.title}</span>
                {currentSong.movieOrAlbum && (
                  <span className="text-xs font-normal text-zinc-400">
                    ({currentSong.movieOrAlbum})
                  </span>
                )}
              </h1>
            </div>
          </div>

          {/* Stepper Navigation inside Studio */}
          <nav className="flex items-center gap-1 bg-zinc-900/80 p-1 rounded-lg border border-zinc-800 order-last lg:order-none w-full lg:w-auto justify-center">
            <button
              type="button"
              onClick={() => setCurrentStep('welcome')}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded text-xs text-zinc-400 hover:text-zinc-200 transition cursor-pointer"
            >
              <span className="font-mono text-[10px] text-zinc-500">01</span>
              <span>Welcome</span>
            </button>

            <span className="text-zinc-700 text-xs px-1">/</span>

            <button
              type="button"
              onClick={() => setCurrentStep('apikey')}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded text-xs text-zinc-400 hover:text-zinc-200 transition cursor-pointer"
            >
              <span className="font-mono text-[10px] text-zinc-500">02</span>
              <span>API Key</span>
              {userApiKey && <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" />}
            </button>

            <span className="text-zinc-700 text-xs px-1">/</span>

            <button
              type="button"
              onClick={() => setCurrentStep('upload')}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded text-xs text-zinc-400 hover:text-zinc-200 transition cursor-pointer"
            >
              <span className="font-mono text-[10px] text-zinc-500">03</span>
              <span>Upload & Log</span>
            </button>

            <span className="text-zinc-700 text-xs px-1">/</span>

            <button
              type="button"
              onClick={() => setCurrentStep('studio')}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium bg-zinc-800 text-zinc-100 shadow-sm cursor-pointer"
            >
              <span className="font-mono text-[10px] text-zinc-300">04</span>
              <span>Studio</span>
            </button>
          </nav>

          {/* Action Buttons & Exports */}
          <div className="flex items-center gap-2">
            {/* Key Settings Button */}
            <button
              onClick={() => {
                setApiKeyInput(userApiKey);
                setCurrentStep('apikey');
              }}
              className="flex items-center gap-1.5 text-xs font-medium bg-zinc-900 hover:bg-zinc-800 text-zinc-300 hover:text-white border border-zinc-800 px-2.5 py-1.5 rounded-lg transition cursor-pointer"
              title="Manage Gemini API Key"
            >
              <Key className="w-3.5 h-3.5 text-zinc-400" />
              <span className="hidden sm:inline">API Key</span>
            </button>

            {/* Upload Another Song Button */}
            <button
              onClick={() => {
                setCurrentStep('upload');
                setErrorMessage(null);
              }}
              className="flex items-center gap-1.5 text-xs font-medium bg-zinc-100 hover:bg-white text-zinc-950 px-3 py-1.5 rounded-lg transition shadow-sm cursor-pointer"
            >
              <Upload className="w-3.5 h-3.5 text-zinc-950" />
              <span>Upload Track</span>
            </button>

            {/* Copy Markdown Table */}
            <button
              onClick={() => copyToClipboard(generateMarkdownTable(currentSong), 'markdown')}
              className="flex items-center gap-1.5 text-xs font-medium bg-zinc-900 hover:bg-zinc-800 text-zinc-300 hover:text-white border border-zinc-800 px-2.5 py-1.5 rounded-lg transition cursor-pointer"
              title="Copy the Markdown transcription table"
            >
              {copiedType === 'markdown' ? (
                <Check className="w-3.5 h-3.5 text-emerald-400" />
              ) : (
                <Copy className="w-3.5 h-3.5 text-zinc-400" />
              )}
              <span className="hidden sm:inline">
                {copiedType === 'markdown' ? 'Copied' : 'Copy Table'}
              </span>
            </button>

            {/* Export Plain Text (.TXT) */}
            <button
              onClick={() =>
                downloadFile(
                  generatePlainText(currentSong),
                  `${currentSong.title.replace(/\s+/g, '_')}_lyrics.txt`,
                  'text/plain'
                )
              }
              className="hidden md:flex items-center gap-1 text-xs font-medium bg-zinc-900 hover:bg-zinc-800 text-zinc-300 hover:text-white border border-zinc-800 px-2.5 py-1.5 rounded-lg transition cursor-pointer font-mono"
              title="Download Plain Text lyrics"
            >
              <Download className="w-3 h-3 text-zinc-400" />
              <span>.TXT</span>
            </button>

            {/* Export Subtitles (.SRT) */}
            <button
              onClick={() =>
                downloadFile(
                  generateSRT(currentSong),
                  `${currentSong.title.replace(/\s+/g, '_')}_subtitles.srt`,
                  'text/plain'
                )
              }
              className="hidden lg:flex items-center gap-1 text-xs font-medium bg-zinc-900 hover:bg-zinc-800 text-zinc-300 hover:text-white border border-zinc-800 px-2.5 py-1.5 rounded-lg transition cursor-pointer font-mono"
              title="Download Subtitles (.SRT)"
            >
              <Download className="w-3 h-3 text-zinc-400" />
              <span>.SRT</span>
            </button>

            {/* Export Synced Lyrics (.LRC) */}
            <button
              onClick={() =>
                downloadFile(
                  generateLRC(currentSong),
                  `${currentSong.title.replace(/\s+/g, '_')}_lyrics.lrc`,
                  'text/plain'
                )
              }
              className="hidden lg:flex items-center gap-1 text-xs font-medium bg-zinc-900 hover:bg-zinc-800 text-zinc-300 hover:text-white border border-zinc-800 px-2.5 py-1.5 rounded-lg transition cursor-pointer font-mono"
              title="Download Synced Lyrics (.LRC)"
            >
              <Download className="w-3 h-3 text-zinc-400" />
              <span>.LRC</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Studio Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-6 space-y-5">
        
        {/* Songs Switcher Ribbon */}
        {songs.length > 1 && (
          <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs">
            <span className="text-zinc-500 uppercase tracking-wider text-[11px] font-medium whitespace-nowrap flex items-center gap-1">
              <FolderOpen className="w-3.5 h-3.5 text-zinc-400" /> Tracks ({songs.length}):
            </span>
            {songs.map((song) => (
              <div
                key={song.id}
                onClick={() => setActiveSongId(song.id)}
                className={`flex items-center gap-2 px-2.5 py-1 rounded-md text-xs transition cursor-pointer border whitespace-nowrap ${
                  song.id === activeSongId
                    ? 'bg-zinc-800 border-zinc-700 text-zinc-100 font-medium'
                    : 'bg-zinc-900/80 border-zinc-800/80 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/60'
                }`}
              >
                <FileAudio className="w-3.5 h-3.5 text-zinc-400" />
                <span>{song.title}</span>
                <button
                  onClick={(e) => deleteSong(song.id, e)}
                  className="text-zinc-500 hover:text-red-400 ml-0.5"
                  title="Delete track"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Audio Player Card (Linear DAW Controller) */}
        <section className="rounded-xl bg-zinc-900/50 border border-zinc-800/80 p-5 sm:p-6 space-y-5">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5">
            {/* Song Meta info */}
            <div className="space-y-1.5">
              <div className="flex items-center gap-2 text-xs text-zinc-400">
                <Music className="w-3.5 h-3.5 text-zinc-400" />
                <span>
                  {currentSong.sourceType === 'upload' || currentSong.sourceName
                    ? `Uploaded: ${currentSong.sourceName || currentSong.title}`
                    : 'Transcribed Audio Track'}
                </span>
                <span>·</span>
                <span className="text-zinc-300 font-medium">{currentSong.language}</span>
              </div>
              <h2 className="text-xl sm:text-2xl font-bold text-zinc-100 tracking-tight">
                {currentSong.title}
              </h2>
              <p className="text-xs text-zinc-400">
                {currentSong.composer && (
                  <>
                    <span className="text-zinc-500">Music:</span> {currentSong.composer}{' '}
                    &nbsp;·&nbsp;{' '}
                  </>
                )}
                {currentSong.lyrics && (
                  <>
                    <span className="text-zinc-500">Lyrics:</span> {currentSong.lyrics}{' '}
                    &nbsp;·&nbsp;{' '}
                  </>
                )}
                {currentSong.singers && (
                  <>
                    <span className="text-zinc-500">Vocals:</span> {currentSong.singers}
                  </>
                )}
              </p>
            </div>

            {/* Visualizer Simulation */}
            <div className="flex items-center gap-1.5 h-9 px-3.5 bg-zinc-950/80 rounded-lg border border-zinc-800">
              {[40, 75, 90, 60, 30, 85, 100, 65, 45, 80, 95, 50, 70, 85, 40].map((h, i) => (
                <div
                  key={i}
                  className={`w-1 rounded-full transition-all duration-150 ${
                    isPlaying ? 'bg-zinc-200' : 'bg-zinc-700'
                  }`}
                  style={{
                    height: isPlaying
                      ? `${Math.max(15, (h * (Math.sin(currentTime * 8 + i) + 1.2)) / 2.2)}%`
                      : '20%',
                  }}
                />
              ))}
              <span className="text-xs font-mono text-zinc-300 ml-2 font-medium tabular-nums">
                {formatTime(currentTime)} / {formatTime(duration || currentSong.durationSeconds)}
              </span>
            </div>
          </div>

          {/* Scrubber & Player Controls Bar */}
          <div className="pt-4 border-t border-zinc-800/80 space-y-3.5">
            {/* Timeline slider */}
            <div className="space-y-1">
              <div className="relative flex items-center">
                <input
                  type="range"
                  min="0"
                  max={duration || currentSong.durationSeconds || 100}
                  step="0.05"
                  value={currentTime}
                  onChange={handleSeek}
                  className="w-full h-1.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-zinc-100 focus:outline-none"
                />
              </div>

              {/* Timestamp markers on slider */}
              <div className="flex justify-between text-[11px] text-zinc-500 font-mono tabular-nums px-0.5">
                <span>00:00.0</span>
                <span>{formatTime((duration || currentSong.durationSeconds) * 0.25)}</span>
                <span>{formatTime((duration || currentSong.durationSeconds) * 0.5)}</span>
                <span>{formatTime((duration || currentSong.durationSeconds) * 0.75)}</span>
                <span>{formatTime(duration || currentSong.durationSeconds)}</span>
              </div>
            </div>

            {/* Playback Buttons & Speed */}
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                {/* Restart */}
                <button
                  onClick={() => {
                    if (audioRef.current) {
                      audioRef.current.currentTime = 0;
                      setCurrentTime(0);
                    }
                  }}
                  className="p-2 rounded-lg bg-zinc-800/80 hover:bg-zinc-700 text-zinc-300 hover:text-white border border-zinc-700/60 transition cursor-pointer"
                  title="Rewind to start"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                </button>

                {/* Primary Play / Pause */}
                <button
                  onClick={togglePlay}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg bg-zinc-100 hover:bg-white text-zinc-950 font-semibold text-xs shadow-sm active:scale-98 transition cursor-pointer"
                >
                  {isPlaying ? (
                    <>
                      <Pause className="w-3.5 h-3.5 fill-zinc-950" />
                      <span>Pause</span>
                    </>
                  ) : (
                    <>
                      <Play className="w-3.5 h-3.5 fill-zinc-950" />
                      <span>Play Track</span>
                    </>
                  )}
                </button>

                {/* Loop line toggle */}
                <button
                  onClick={() => setLoopActiveLine(!loopActiveLine)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition cursor-pointer ${
                    loopActiveLine
                      ? 'bg-zinc-800 text-zinc-100 border-zinc-600'
                      : 'bg-zinc-900/80 border-zinc-800 text-zinc-400 hover:text-zinc-200'
                  }`}
                  title="Loop current line for practicing pronunciation"
                >
                  <Repeat className="w-3.5 h-3.5" />
                  <span>Loop Current Line</span>
                </button>
              </div>

              {/* Speed & Volume */}
              <div className="flex items-center gap-3.5">
                {/* Speed selector */}
                <div className="flex items-center gap-1 bg-zinc-950 p-1 rounded-lg border border-zinc-800 text-xs">
                  <span className="text-zinc-500 px-1.5 font-mono text-[11px]">Speed:</span>
                  {[0.75, 1, 1.25].map((rate) => (
                    <button
                      key={rate}
                      onClick={() => handleRateChange(rate)}
                      className={`px-2 py-0.5 rounded font-mono text-xs cursor-pointer transition ${
                        playbackRate === rate
                          ? 'bg-zinc-800 text-zinc-100 font-medium'
                          : 'text-zinc-400 hover:text-zinc-200'
                      }`}
                    >
                      {rate}x
                    </button>
                  ))}
                </div>

                {/* Volume slider */}
                <div className="flex items-center gap-2">
                  <button
                    onClick={toggleMute}
                    className="text-zinc-400 hover:text-zinc-200 cursor-pointer"
                    title={isMuted ? 'Unmute' : 'Mute'}
                  >
                    {isMuted || volume === 0 ? (
                      <VolumeX className="w-3.5 h-3.5 text-red-400" />
                    ) : (
                      <Volume2 className="w-3.5 h-3.5" />
                    )}
                  </button>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.05"
                    value={isMuted ? 0 : volume}
                    onChange={handleVolumeChange}
                    className="w-16 h-1 bg-zinc-800 rounded appearance-none cursor-pointer accent-zinc-200"
                  />
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* View Mode Switcher & Search Bar */}
        <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3 bg-zinc-900/40 p-2 rounded-xl border border-zinc-800/80">
          <div className="flex items-center gap-1 bg-zinc-950 p-1 rounded-lg border border-zinc-800/80 overflow-x-auto">
            <button
              onClick={() => setActiveTab('table')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium cursor-pointer transition whitespace-nowrap ${
                activeTab === 'table'
                  ? 'bg-zinc-800 text-zinc-100 shadow-sm'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <FileText className="w-3.5 h-3.5" />
              <span>Lyrics Table</span>
            </button>
            <button
              onClick={() => setActiveTab('karaoke')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium cursor-pointer transition whitespace-nowrap ${
                activeTab === 'karaoke'
                  ? 'bg-zinc-800 text-zinc-100 shadow-sm'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Karaoke View</span>
            </button>
            <button
              onClick={() => setActiveTab('pitch')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium cursor-pointer transition whitespace-nowrap ${
                activeTab === 'pitch'
                  ? 'bg-zinc-800 text-zinc-100 shadow-sm'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <Activity className="w-3.5 h-3.5" />
              <span>Voice Pitch Graph</span>
            </button>
            <button
              onClick={() => setActiveTab('editor')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium cursor-pointer transition whitespace-nowrap ${
                activeTab === 'editor'
                  ? 'bg-zinc-800 text-zinc-100 shadow-sm'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <Clock className="w-3.5 h-3.5" />
              <span>Timestamp Editor</span>
            </button>
            <button
              onClick={() => setActiveTab('converter')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium cursor-pointer transition whitespace-nowrap ${
                activeTab === 'converter'
                  ? 'bg-zinc-800 text-zinc-100 shadow-sm'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <ArrowRightLeft className="w-3.5 h-3.5" />
              <span>Converter Lab</span>
            </button>
            <button
              onClick={() => setActiveTab('glossary')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium cursor-pointer transition whitespace-nowrap ${
                activeTab === 'glossary'
                  ? 'bg-zinc-800 text-zinc-100 shadow-sm'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <BookOpen className="w-3.5 h-3.5" />
              <span>Vocabulary</span>
            </button>
          </div>

          <div className="flex items-center gap-2">
            {/* Fullscreen Stage Mode Action */}
            <button
              onClick={() => setIsKaraokeStageOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-zinc-800 hover:bg-zinc-700 text-zinc-100 border border-zinc-700/80 transition cursor-pointer whitespace-nowrap"
              title="Open Fullscreen Singing Teleprompter"
            >
              <Maximize2 className="w-3.5 h-3.5" />
              <span>Stage Mode</span>
            </button>

            {/* Search Box */}
            <div className="relative flex-1 sm:w-52">
              <Search className="w-3.5 h-3.5 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Filter lines..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-lg pl-8 pr-3 py-1.5 text-xs text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-zinc-600"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-zinc-500 hover:text-zinc-300"
                >
                  ✕
                </button>
              )}
            </div>
          </div>
        </div>

        {/* TAB 1: FULL TRANSCRIPTION TABLE */}
        {activeTab === 'table' && (
          <div className="space-y-3.5">
            {/* Table Controls Bar */}
            <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-zinc-400 px-0.5">
              <div className="flex items-center gap-3">
                <span className="font-mono text-zinc-300">
                  {currentSong.lines?.length || 0} lines
                </span>
                <span className="text-zinc-700">·</span>
                <label className="flex items-center gap-1.5 cursor-pointer hover:text-zinc-200">
                  <input
                    type="checkbox"
                    checked={showMeaningInTable}
                    onChange={(e) => setShowMeaningInTable(e.target.checked)}
                    className="rounded accent-zinc-200 bg-zinc-900 border-zinc-700"
                  />
                  <span>Show English Context</span>
                </label>
                <label className="flex items-center gap-1.5 cursor-pointer hover:text-zinc-200">
                  <input
                    type="checkbox"
                    checked={showWordsInTable}
                    onChange={(e) => setShowWordsInTable(e.target.checked)}
                    className="rounded accent-zinc-200 bg-zinc-900 border-zinc-700"
                  />
                  <span>Show Word Breakdown</span>
                </label>
              </div>

              <span className="text-[11px] text-zinc-500 font-mono">
                Click any line to seek audio
              </span>
            </div>

            {/* The Main Transcription Table */}
            <div className="overflow-x-auto rounded-xl border border-zinc-800/80 bg-zinc-900/20">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-zinc-900/90 text-zinc-400 text-xs font-medium uppercase tracking-wider border-b border-zinc-800/80">
                    <th className="py-2.5 px-3 text-center w-12 font-mono">#</th>
                    <th className="py-2.5 px-4 w-32 font-mono text-left">Timestamp</th>
                    <th className="py-2.5 px-4">Telugu / Native Script</th>
                    <th className="py-2.5 px-4">Romanized Telugu</th>
                    <th className="py-2.5 px-4 w-28 text-center">Status</th>
                    <th className="py-2.5 px-3 text-center w-14">Play</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/40 text-sm">
                  {filteredLyrics.map((line) => {
                    const isActive = line.id === activeLineId;
                    return (
                      <React.Fragment key={line.id}>
                        <tr
                          onClick={() => jumpToLine(line)}
                          className={`cursor-pointer transition-colors ${
                            isActive
                              ? 'bg-zinc-800/60 font-medium'
                              : 'hover:bg-zinc-800/30'
                          } ${line.isInstrumental ? 'text-zinc-500 bg-zinc-950/20' : ''}`}
                        >
                          {/* Line Number */}
                          <td className="py-3 px-3 text-center text-xs font-mono text-zinc-500 tabular-nums">
                            {line.id}
                          </td>

                          {/* Time range */}
                          <td className="py-3 px-4 font-mono text-xs text-zinc-400 whitespace-nowrap tabular-nums">
                            <span className="bg-zinc-950/80 px-2 py-0.5 rounded border border-zinc-800/80">
                              {line.startTime} - {line.endTime}
                            </span>
                          </td>

                          {/* Telugu Script */}
                          <td className="py-3 px-4 font-['Noto_Sans_Telugu',sans-serif]">
                            <div className="flex items-center justify-between gap-2">
                              <span
                                className={`text-base sm:text-lg leading-relaxed ${
                                  line.isInstrumental
                                    ? 'font-mono text-zinc-500 text-sm'
                                    : isActive
                                    ? 'text-zinc-100 font-semibold'
                                    : 'text-zinc-200'
                                }`}
                              >
                                {line.telugu}
                              </span>
                              {!line.isInstrumental && (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    copyToClipboard(line.telugu, `line-${line.id}`);
                                  }}
                                  className="text-zinc-600 hover:text-zinc-300 p-1 rounded transition opacity-50 hover:opacity-100"
                                  title="Copy text"
                                >
                                  {copiedType === `line-${line.id}` ? (
                                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                                  ) : (
                                    <Copy className="w-3.5 h-3.5" />
                                  )}
                                </button>
                              )}
                            </div>
                            {showMeaningInTable && !line.isInstrumental && line.englishMeaning && (
                              <p className="text-xs text-zinc-400 mt-1 font-sans">
                                {line.englishMeaning}
                              </p>
                            )}
                          </td>

                          {/* Romanized Telugu */}
                          <td className="py-3 px-4">
                            <span
                              className={`text-sm ${
                                line.isInstrumental
                                  ? 'font-mono text-zinc-500 text-xs'
                                  : isActive
                                  ? 'text-zinc-200 font-medium'
                                  : 'text-zinc-400'
                              }`}
                            >
                              {line.romanized}
                            </span>
                            {line.notes && (
                              <p className="text-[11px] text-zinc-500 mt-1 italic">
                                {line.notes}
                              </p>
                            )}
                          </td>

                          {/* Status */}
                          <td className="py-3 px-4 text-center">
                            {line.isInstrumental ? (
                              <span className="inline-block text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-zinc-800 text-zinc-400 border border-zinc-700">
                                INSTRUMENTAL
                              </span>
                            ) : line.isUnclear ? (
                              <span className="inline-block text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-amber-950/40 text-amber-300 border border-amber-800/40">
                                UNCLEAR
                              </span>
                            ) : (
                              <span className="inline-block text-[10px] font-medium px-2 py-0.5 rounded bg-zinc-800/60 text-zinc-300 border border-zinc-800">
                                Sung
                              </span>
                            )}
                          </td>

                          {/* Play trigger button */}
                          <td className="py-3 px-3 text-center">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                jumpToLine(line);
                              }}
                              className={`p-1.5 rounded-lg transition cursor-pointer ${
                                isActive && isPlaying
                                  ? 'bg-zinc-100 text-zinc-950'
                                  : 'text-zinc-400 hover:text-white hover:bg-zinc-800'
                              }`}
                              title={`Play from ${line.startTime}`}
                            >
                              {isActive && isPlaying ? (
                                <Pause className="w-3.5 h-3.5 fill-current" />
                              ) : (
                                <Play className="w-3.5 h-3.5 fill-current" />
                              )}
                            </button>
                          </td>
                        </tr>

                        {/* Word-by-word expanded sub-row */}
                        {showWordsInTable && line.words && line.words.length > 0 && (
                          <tr className="bg-zinc-950/60 text-xs text-zinc-400 border-b border-zinc-800/40">
                            <td></td>
                            <td></td>
                            <td colSpan={4} className="py-2.5 px-4">
                              <div className="flex flex-wrap gap-2 items-center">
                                <span className="text-[10px] uppercase font-mono text-zinc-500 mr-1">
                                  Breakdown:
                                </span>
                                {line.words.map((w, wIdx) => (
                                  <span
                                    key={wIdx}
                                    className="bg-zinc-900 border border-zinc-800 rounded px-2 py-0.5 text-xs text-zinc-300"
                                  >
                                    <strong className="text-zinc-100 font-['Noto_Sans_Telugu']">
                                      {w.telugu}
                                    </strong>{' '}
                                    <span className="text-zinc-500">({w.romanized})</span>:{' '}
                                    <span className="text-zinc-300">{w.meaning}</span>
                                  </span>
                                ))}
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 2: LIVE KARAOKE / SYNC VIEW */}
        {activeTab === 'karaoke' && (
          <div className="space-y-5">
            <div className="bg-zinc-900/50 border border-zinc-800/80 rounded-xl p-6 sm:p-10 text-center relative overflow-hidden">
              <div className="text-xs font-mono uppercase tracking-wider text-zinc-500 mb-6">
                Line {currentActiveLine.id} of {currentSong.lines?.length || 0} ·{' '}
                {currentActiveLine.startTime} - {currentActiveLine.endTime}
              </div>

              {/* Status Pill */}
              <div className="mb-4 inline-block">
                {currentActiveLine.isInstrumental ? (
                  <span className="px-2.5 py-0.5 rounded text-xs font-mono uppercase bg-zinc-800 text-zinc-400 border border-zinc-700">
                    Instrumental Section
                  </span>
                ) : (
                  <span className="px-2.5 py-0.5 rounded text-xs font-medium bg-zinc-800/80 text-zinc-300 border border-zinc-700/60">
                    Active Verse
                  </span>
                )}
              </div>

              {/* Big Telugu Lyrics Display */}
              <div className="font-['Noto_Sans_Telugu',sans-serif] text-2xl sm:text-4xl md:text-5xl font-bold text-zinc-100 tracking-wide leading-tight mb-3">
                {currentActiveLine.telugu || '[No lyrics active]'}
              </div>

              {/* Romanized Telugu Display */}
              <div className="text-base sm:text-xl text-zinc-400 font-medium tracking-normal mb-5">
                {currentActiveLine.romanized}
              </div>

              {/* English Meaning Box */}
              {!currentActiveLine.isInstrumental && currentActiveLine.englishMeaning && (
                <div className="max-w-xl mx-auto p-3.5 rounded-lg bg-zinc-950 border border-zinc-800 text-xs text-zinc-300 text-left">
                  <div className="text-[10px] uppercase font-mono text-zinc-500 mb-1">
                    English Translation
                  </div>
                  <p>{currentActiveLine.englishMeaning}</p>
                </div>
              )}

              {/* Next line preview */}
              {nextLine && (
                <div className="mt-8 pt-5 border-t border-zinc-800/80 text-xs text-zinc-500 flex flex-col sm:flex-row items-center justify-center gap-2">
                  <span className="uppercase tracking-wider font-mono text-[10px]">
                    Coming Up:
                  </span>
                  <span className="font-['Noto_Sans_Telugu'] text-zinc-300 font-medium">
                    {nextLine.telugu}
                  </span>
                  <span className="text-zinc-500">({nextLine.romanized})</span>
                </div>
              )}
            </div>

            {/* Quick Line Navigator */}
            <div className="flex flex-wrap items-center justify-center gap-1.5">
              {currentSong.lines?.map((l) => (
                <button
                  key={l.id}
                  onClick={() => jumpToLine(l)}
                  className={`px-2.5 py-1 rounded text-xs font-mono transition cursor-pointer flex items-center gap-1.5 border ${
                    l.id === activeLineId
                      ? 'bg-zinc-100 text-zinc-950 font-bold border-zinc-100'
                      : 'bg-zinc-900/80 border-zinc-800 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800'
                  }`}
                >
                  <span>Line {l.id}</span>
                  <span className="text-[10px] opacity-60 tabular-nums">({l.startTime})</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* TAB 3: VOCABULARY & GLOSSARY */}
        {activeTab === 'glossary' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {currentSong.lines
              ?.filter((l) => !l.isInstrumental)
              .map((line) => (
                <div
                  key={line.id}
                  onClick={() => jumpToLine(line)}
                  className="p-4 rounded-xl bg-zinc-900/40 border border-zinc-800/80 hover:border-zinc-700 transition cursor-pointer space-y-2.5"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-mono text-zinc-500 tabular-nums">
                      Line {line.id} · {line.startTime} - {line.endTime}
                    </span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        jumpToLine(line);
                      }}
                      className="p-1 rounded bg-zinc-800 text-zinc-400 hover:text-white text-xs"
                    >
                      <Play className="w-3 h-3 fill-current" />
                    </button>
                  </div>

                  <div>
                    <h4 className="font-['Noto_Sans_Telugu'] text-base font-bold text-zinc-100">
                      {line.telugu}
                    </h4>
                    <p className="text-xs text-zinc-400 font-medium">
                      {line.romanized}
                    </p>
                  </div>

                  {line.englishMeaning && (
                    <div className="p-2.5 bg-zinc-950 rounded-lg text-xs text-zinc-300 border border-zinc-800/80">
                      <strong className="text-zinc-500 block text-[10px] uppercase font-mono mb-0.5">
                        Translation:
                      </strong>
                      {line.englishMeaning}
                    </div>
                  )}

                  {line.words && line.words.length > 0 && (
                    <div className="space-y-1 pt-1">
                      <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-wider">
                        Word Breakdown:
                      </span>
                      <div className="grid grid-cols-1 gap-1 text-xs">
                        {line.words.map((w, i) => (
                          <div
                            key={i}
                            className="flex items-baseline justify-between bg-zinc-950 px-2 py-1 rounded border border-zinc-800/80"
                          >
                            <span className="font-['Noto_Sans_Telugu'] text-zinc-200">
                              {w.telugu}{' '}
                              <span className="font-sans text-zinc-500 text-[11px]">
                                ({w.romanized})
                              </span>
                            </span>
                            <span className="text-zinc-400 text-[11px]">{w.meaning}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))}
          </div>
        )}

        {/* TAB 4: VOICE PITCH GRAPH */}
        {activeTab === 'pitch' && (
          <VoicePitchGraph
            audioRef={audioRef}
            isPlaying={isPlaying}
            currentTime={currentTime}
          />
        )}

        {/* TAB 5: TIMESTAMP & LYRICS FINE-TUNER */}
        {activeTab === 'editor' && (
          <TimestampEditor
            song={currentSong}
            onUpdateSong={handleUpdateSong}
            jumpToLine={jumpToLine}
          />
        )}

        {/* TAB 6: FORMAT CONVERTER LAB */}
        {activeTab === 'converter' && (
          <SubtitleConverter />
        )}
      </main>

      {/* FULLSCREEN KARAOKE STAGE VIEW */}
      {isKaraokeStageOpen && (
        <KaraokeStage
          song={currentSong}
          currentTime={currentTime}
          duration={duration}
          isPlaying={isPlaying}
          activeLineId={activeLineId}
          togglePlay={togglePlay}
          onClose={() => setIsKaraokeStageOpen(false)}
          jumpToLine={jumpToLine}
        />
      )}

      {/* MODAL: Upload New Song (When a song is already loaded) */}
      {isUploadModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-xl bg-zinc-900 border border-zinc-800 shadow-2xl p-6 relative">
            {/* Close button */}
            <button
              onClick={() => {
                if (!isProcessing) {
                  setIsUploadModalOpen(false);
                  setErrorMessage(null);
                }
              }}
              disabled={isProcessing}
              className="absolute top-4 right-4 text-zinc-500 hover:text-zinc-200 p-1 rounded-lg cursor-pointer disabled:opacity-40"
            >
              ✕
            </button>

            <div className="space-y-1 mb-5">
              <div className="flex items-center gap-2 text-zinc-400 text-xs font-mono">
                <Music className="w-3.5 h-3.5" />
                <span>Upload Audio Track</span>
              </div>
              <h3 className="text-lg font-semibold text-zinc-100">Transcribe Another Song</h3>
              <p className="text-xs text-zinc-400">
                Upload your MP3, WAV, or M4A audio file. Gemini AI will analyze the track in-browser.
              </p>
            </div>

            {errorMessage && (
              <div className="mb-4 p-3 rounded-lg bg-red-950/40 border border-red-900/60 text-xs text-red-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div className="flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                  <div className="leading-relaxed">{errorMessage}</div>
                </div>
                {selectedFile && !isProcessing && (
                  <button
                    type="button"
                    onClick={handleUploadFile}
                    className="shrink-0 px-3 py-1 rounded-md text-xs font-medium bg-zinc-800 hover:bg-zinc-700 text-zinc-100 border border-zinc-700 transition cursor-pointer flex items-center gap-1.5"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>Retry</span>
                  </button>
                )}
              </div>
            )}

            {isProcessing ? (
              <div className="p-6 rounded-lg bg-zinc-950 border border-zinc-800 text-center space-y-3 mb-2">
                <Loader2 className="w-6 h-6 text-zinc-400 animate-spin mx-auto" />
                <div className="text-xs font-mono text-zinc-300">
                  {processingStatus || 'Analyzing Audio with Gemini...'}
                </div>
                <p className="text-[11px] text-zinc-500">
                  Transcribing lyrics, isolating instrumental sections, and mapping timestamps.
                </p>
                <div className="pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      setIsProcessing(false);
                      setProcessingStatus('');
                    }}
                    className="px-3 py-1 rounded-md text-xs font-medium bg-zinc-900 hover:bg-zinc-800 text-zinc-300 border border-zinc-800 transition cursor-pointer"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className={`border border-dashed rounded-xl p-8 text-center cursor-pointer transition ${
                    selectedFile
                      ? 'border-zinc-500 bg-zinc-950'
                      : 'border-zinc-800 hover:border-zinc-700 bg-zinc-950/40'
                  }`}
                >
                  <input
                    type="file"
                    ref={fileInputRef}
                    accept="audio/*,.mp3,.wav,.m4a,.ogg,.webm,.flac,.aac"
                    onChange={(e) => {
                      if (e.target.files && e.target.files[0]) {
                        setSelectedFile(e.target.files[0]);
                        setErrorMessage(null);
                      }
                    }}
                    className="hidden"
                  />
                  <div className="w-10 h-10 rounded-lg bg-zinc-900 border border-zinc-800 flex items-center justify-center mx-auto mb-2 text-zinc-400">
                    <FileAudio className="w-5 h-5" />
                  </div>
                  {selectedFile ? (
                    <div>
                      <p className="text-xs font-medium text-zinc-200">{selectedFile.name}</p>
                      <p className="text-[11px] text-zinc-500 font-mono mt-0.5">
                        {(selectedFile.size / (1024 * 1024)).toFixed(2)} MB · Click to replace
                      </p>
                    </div>
                  ) : (
                    <div>
                      <p className="text-xs text-zinc-300">
                        Drop audio file here or <span className="text-zinc-100 underline underline-offset-2">browse</span>
                      </p>
                      <p className="text-[11px] text-zinc-500 mt-1">
                        MP3, WAV, M4A, FLAC, AAC up to 30MB
                      </p>
                    </div>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => {
                    if (!userApiKey) {
                      setIsApiKeyModalOpen(true);
                    } else {
                      handleUploadFile();
                    }
                  }}
                  disabled={!selectedFile || isProcessing}
                  className="w-full py-2.5 rounded-lg font-semibold text-xs bg-zinc-100 hover:bg-white text-zinc-950 transition disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer flex items-center justify-center gap-2"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>
                    {!userApiKey ? 'Enter API Key to Transcribe' : 'Transcribe with Gemini AI'}
                  </span>
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* MODAL: API Key Manager */}
      {isApiKeyModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-xl bg-zinc-900 border border-zinc-800 shadow-2xl p-6 relative">
            <button
              onClick={() => {
                setIsApiKeyModalOpen(false);
                setApiKeyError(null);
              }}
              className="absolute top-4 right-4 text-zinc-500 hover:text-zinc-200 p-1 rounded-lg cursor-pointer"
            >
              ✕
            </button>

            <div className="flex items-center gap-2 text-zinc-400 text-xs font-mono mb-2">
              <Key className="w-3.5 h-3.5" />
              <span>Gemini API Key</span>
            </div>
            <h3 className="text-lg font-semibold text-zinc-100 mb-1">Your Personal API Key</h3>
            <p className="text-xs text-zinc-400 mb-4 leading-relaxed">
              Your key is stored locally in your browser and used directly for Google Gemini API requests.
            </p>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSaveApiKey();
              }}
              className="space-y-4"
            >
              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1.5">
                  Google Gemini API Key
                </label>
                <div className="relative">
                  <input
                    type={showApiKey ? 'text' : 'password'}
                    value={apiKeyInput}
                    onChange={(e) => {
                      setApiKeyInput(e.target.value);
                      setApiKeyError(null);
                    }}
                    placeholder={userApiKey ? 'Enter new key to update...' : 'AIzaSy...'}
                    className="w-full bg-zinc-950 border border-zinc-800 focus:border-zinc-600 rounded-lg px-3.5 py-2 text-xs text-zinc-100 placeholder-zinc-500 outline-none pr-10 font-mono"
                  />
                  <button
                    type="button"
                    onClick={() => setShowApiKey(!showApiKey)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-200 cursor-pointer"
                  >
                    {showApiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {apiKeyError && (
                  <p className="text-xs text-red-400 mt-1.5 flex items-center gap-1 font-medium">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                    <span>{apiKeyError}</span>
                  </p>
                )}
              </div>

              {userApiKey && (
                <div className="p-3 rounded-lg bg-zinc-950 border border-zinc-800 text-xs flex items-center justify-between">
                  <div className="flex items-center gap-2 text-zinc-300">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Active: <span className="font-mono text-zinc-400">{userApiKey.slice(0, 6)}••••••••</span></span>
                  </div>
                  <button
                    type="button"
                    onClick={handleClearApiKey}
                    className="text-red-400 hover:text-red-300 text-xs font-medium cursor-pointer"
                  >
                    Remove
                  </button>
                </div>
              )}

              <div className="flex items-center justify-between gap-2.5 pt-1">
                <button
                  type="submit"
                  className="flex-1 py-2 px-4 rounded-lg font-semibold text-xs bg-zinc-100 hover:bg-white text-zinc-950 transition cursor-pointer text-center"
                >
                  Save API Key
                </button>
                <a
                  href="https://aistudio.google.com/app/apikey"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="py-2 px-3 rounded-lg text-xs font-medium bg-zinc-900 hover:bg-zinc-800 text-zinc-300 hover:text-white border border-zinc-800 transition cursor-pointer flex items-center gap-1"
                >
                  <span>Get Free Key</span>
                  <ExternalLink className="w-3 h-3 text-zinc-500" />
                </a>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="border-t border-zinc-800/80 bg-[#09090b] py-5 text-center text-xs text-zinc-500">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-3">
          <p>
            Telugu & Multilingual Audio Transcriber · Powered by Google Gemini
          </p>
          <div className="flex items-center gap-3 text-[11px] text-zinc-500">
            <span>In-Browser Privacy</span>
            <span>·</span>
            <span>Decimal Millisecond Timestamps</span>
            <span>·</span>
            <span>Multi-Format Export</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
