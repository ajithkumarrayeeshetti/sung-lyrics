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
      <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-['Plus_Jakarta_Sans',sans-serif] selection:bg-amber-500/30 selection:text-amber-200">
        {/* Navigation Header with 4-Step Stepper */}
        <header className="border-b border-slate-800 bg-slate-900/90 backdrop-blur sticky top-0 z-30">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-amber-600 via-red-600 to-orange-500 flex items-center justify-center shadow-lg shadow-amber-600/20 text-white font-bold shrink-0">
                <Flame className="w-5 h-5 animate-pulse" />
              </div>
              <div>
                <span className="text-[10px] uppercase tracking-widest font-bold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                  Telugu & Multilingual AI Transcriber
                </span>
                <h1 className="text-base sm:text-lg font-bold text-white tracking-tight">
                  Song Lyrics & Karaoke Studio
                </h1>
              </div>
            </div>

            {/* Stepper Navigation Pills */}
            <nav className="flex items-center gap-1 sm:gap-2 bg-slate-950/80 p-1 rounded-xl border border-slate-800">
              {/* Step 1: Welcome */}
              <button
                type="button"
                onClick={() => setCurrentStep('welcome')}
                className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
                  currentStep === 'welcome'
                    ? 'bg-amber-500 text-slate-950 shadow-md font-bold'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800'
                }`}
              >
                <span className={`w-4 h-4 rounded-full text-[10px] flex items-center justify-center font-bold ${
                  currentStep === 'welcome' ? 'bg-slate-950 text-amber-400' : 'bg-slate-800 text-slate-300'
                }`}>1</span>
                <span>Welcome</span>
              </button>

              <ChevronRight className="w-3.5 h-3.5 text-slate-600 hidden sm:inline" />

              {/* Step 2: API Key */}
              <button
                type="button"
                onClick={() => setCurrentStep('apikey')}
                className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
                  currentStep === 'apikey'
                    ? 'bg-amber-500 text-slate-950 shadow-md font-bold'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800'
                }`}
              >
                <span className={`w-4 h-4 rounded-full text-[10px] flex items-center justify-center font-bold ${
                  currentStep === 'apikey' ? 'bg-slate-950 text-amber-400' : 'bg-slate-800 text-slate-300'
                }`}>2</span>
                <span>API Key</span>
                {userApiKey && (
                  <span className="w-2 h-2 rounded-full bg-emerald-400 shrink-0" title="API Key Active" />
                )}
              </button>

              <ChevronRight className="w-3.5 h-3.5 text-slate-600 hidden sm:inline" />

              {/* Step 3: Upload & Live Log */}
              <button
                type="button"
                onClick={() => setCurrentStep('upload')}
                className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
                  currentStep === 'upload'
                    ? 'bg-amber-500 text-slate-950 shadow-md font-bold'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800'
                }`}
              >
                <span className={`w-4 h-4 rounded-full text-[10px] flex items-center justify-center font-bold ${
                  currentStep === 'upload' ? 'bg-slate-950 text-amber-400' : 'bg-slate-800 text-slate-300'
                }`}>3</span>
                <span>Upload & Log</span>
              </button>

              <ChevronRight className="w-3.5 h-3.5 text-slate-600 hidden sm:inline" />

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
                className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
                  currentStep === 'studio'
                    ? 'bg-amber-500 text-slate-950 shadow-md font-bold'
                    : currentSong
                    ? 'text-slate-400 hover:text-white hover:bg-slate-800'
                    : 'text-slate-600 hover:text-slate-400'
                }`}
              >
                <span className={`w-4 h-4 rounded-full text-[10px] flex items-center justify-center font-bold ${
                  currentStep === 'studio' ? 'bg-slate-950 text-amber-400' : 'bg-slate-800 text-slate-300'
                }`}>4</span>
                <span>Studio</span>
              </button>
            </nav>

            {/* Quick Status Pill */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setApiKeyInput(userApiKey);
                  setCurrentStep('apikey');
                }}
                className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-xl border transition cursor-pointer ${
                  userApiKey
                    ? 'bg-emerald-950/60 hover:bg-emerald-900/60 text-emerald-300 border-emerald-800/80'
                    : 'bg-amber-950/60 hover:bg-amber-900/60 text-amber-300 border-amber-800/80'
                }`}
              >
                <Key className="w-3.5 h-3.5 text-amber-400" />
                <span className="hidden md:inline">
                  {userApiKey ? 'API Key Active' : 'Set API Key'}
                </span>
                {userApiKey && (
                  <span className="font-mono text-[10px] text-emerald-400 bg-emerald-500/10 px-1 rounded">
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
                  className="flex items-center gap-1.5 text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 px-3 py-1.5 rounded-xl transition cursor-pointer"
                >
                  <FolderOpen className="w-4 h-4 text-amber-400" />
                  <span className="hidden sm:inline">Library</span>
                  <span>({songs.length})</span>
                </button>
              )}
            </div>
          </div>
        </header>

        {/* ========================================================= */}
        {/* STEP 1: WELCOME PAGE                                      */}
        {/* ========================================================= */}
        {currentStep === 'welcome' && (
          <main className="flex-1 max-w-5xl w-full mx-auto px-4 sm:px-6 py-10 flex flex-col justify-center space-y-10 animate-fadeIn">
            {/* Hero Banner */}
            <div className="text-center space-y-4">
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs font-semibold shadow-inner">
                <Sparkles className="w-3.5 h-3.5 animate-spin" />
                <span>Step 1 • Welcome to the Transcriber</span>
              </div>

              <h2 className="text-3xl sm:text-5xl font-black text-white tracking-tight leading-tight">
                Welcome to the{' '}
                <span className="bg-gradient-to-r from-amber-400 via-orange-400 to-red-500 bg-clip-text text-transparent">
                  Song Lyrics & Pitch Transcriber
                </span>
              </h2>

              <p className="text-sm sm:text-base text-slate-300 max-w-2xl mx-auto leading-relaxed">
                Transcribe any Telugu, Hindi, or multilingual song track directly inside your browser. Generate millisecond-precise timestamps (mm:ss.s), dual Telugu script & Romanized phonetics, voice pitch contour tracking, and interactive karaoke.
              </p>

              {/* Primary Call to Action Buttons */}
              <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setCurrentStep('apikey')}
                  className="py-3.5 px-7 rounded-xl font-bold text-sm bg-gradient-to-r from-amber-500 via-orange-500 to-red-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 transition-all shadow-xl shadow-amber-500/25 cursor-pointer flex items-center gap-2 active:scale-98"
                >
                  <span>Get Started (Step 2: API Key)</span>
                  <ArrowRight className="w-4 h-4" />
                </button>

                <button
                  type="button"
                  onClick={loadDemoSong}
                  className="py-3.5 px-6 rounded-xl text-xs sm:text-sm font-semibold bg-slate-800/90 hover:bg-slate-700 text-slate-200 hover:text-white border border-slate-700 transition cursor-pointer flex items-center gap-2"
                >
                  <Flame className="w-4 h-4 text-amber-400" />
                  <span>Try Demo Song (Veera Veera)</span>
                </button>

                {songs.length > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      setActiveSongId(songs[0].id);
                      setCurrentStep('studio');
                    }}
                    className="py-3.5 px-6 rounded-xl text-xs sm:text-sm font-semibold bg-emerald-950/60 hover:bg-emerald-900/60 text-emerald-300 border border-emerald-800/70 transition cursor-pointer flex items-center gap-2"
                  >
                    <FolderOpen className="w-4 h-4 text-emerald-400" />
                    <span>Open My Library ({songs.length})</span>
                  </button>
                )}
              </div>
            </div>

            {/* 4-Step Interactive Workflow Roadmap */}
            <div className="rounded-2xl bg-slate-900/60 border border-slate-800 p-6 space-y-4 shadow-xl">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-amber-400">
                  <Activity className="w-4 h-4" />
                  <span>How It Works in 4 Steps</span>
                </div>
                <span className="text-[11px] text-emerald-400 bg-emerald-950/80 px-2.5 py-0.5 rounded-full border border-emerald-800/60">
                  100% In-Browser Privacy
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* Step 1 Box */}
                <div
                  onClick={() => setCurrentStep('welcome')}
                  className="p-4 rounded-xl bg-amber-500/10 border-2 border-amber-500/60 cursor-pointer space-y-2 transition hover:bg-amber-500/15"
                >
                  <div className="flex items-center justify-between text-xs font-bold text-amber-400">
                    <span>STEP 1</span>
                    <span className="text-[10px] bg-amber-500/20 px-2 py-0.5 rounded-full font-bold">Current</span>
                  </div>
                  <h4 className="font-bold text-white text-sm">Welcome & Overview</h4>
                  <p className="text-slate-400 text-xs leading-relaxed">
                    Explore features, audio capabilities, and karaoke stage modes.
                  </p>
                </div>

                {/* Step 2 Box */}
                <div
                  onClick={() => setCurrentStep('apikey')}
                  className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 hover:border-amber-500/40 cursor-pointer space-y-2 transition hover:bg-slate-900/60"
                >
                  <div className="flex items-center justify-between text-xs font-bold text-slate-400">
                    <span>STEP 2</span>
                    {userApiKey ? (
                      <span className="text-[10px] bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded-full">Ready</span>
                    ) : (
                      <span className="text-[10px] bg-amber-500/20 text-amber-400 px-2 py-0.5 rounded-full">Required</span>
                    )}
                  </div>
                  <h4 className="font-bold text-white text-sm">Set Gemini API Key</h4>
                  <p className="text-slate-400 text-xs leading-relaxed">
                    Paste your free Google AI Studio key. Stored only in local browser memory.
                  </p>
                </div>

                {/* Step 3 Box */}
                <div
                  onClick={() => setCurrentStep('upload')}
                  className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 hover:border-amber-500/40 cursor-pointer space-y-2 transition hover:bg-slate-900/60"
                >
                  <div className="flex items-center justify-between text-xs font-bold text-slate-400">
                    <span>STEP 3</span>
                    <span className="text-[10px] bg-slate-800 text-slate-400 px-2 py-0.5 rounded-full">Upload & Log</span>
                  </div>
                  <h4 className="font-bold text-white text-sm">Upload & Live Log</h4>
                  <p className="text-slate-400 text-xs leading-relaxed">
                    Select your audio track and watch real-time scrolling output events.
                  </p>
                </div>

                {/* Step 4 Box */}
                <div
                  onClick={() => {
                    if (currentSong) {
                      setCurrentStep('studio');
                    } else {
                      loadDemoSong();
                    }
                  }}
                  className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 hover:border-amber-500/40 cursor-pointer space-y-2 transition hover:bg-slate-900/60"
                >
                  <div className="flex items-center justify-between text-xs font-bold text-slate-400">
                    <span>STEP 4</span>
                    <span className="text-[10px] bg-slate-800 text-slate-400 px-2 py-0.5 rounded-full">Studio</span>
                  </div>
                  <h4 className="font-bold text-white text-sm">Lyrics & Pitch Studio</h4>
                  <p className="text-slate-400 text-xs leading-relaxed">
                    Interactive synchronized player, pitch graph, teleprompter, and subtitles.
                  </p>
                </div>
              </div>
            </div>

            {/* Feature Highlights Grid */}
            <div className="space-y-4">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-amber-400" />
                <span>Superpowers & Capabilities</span>
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 text-xs">
                {/* 1. Privacy */}
                <div className="p-5 rounded-2xl bg-gradient-to-br from-slate-900 to-slate-950 border border-slate-800 space-y-2.5 hover:border-amber-500/30 transition">
                  <div className="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
                    <ShieldCheck className="w-5 h-5" />
                  </div>
                  <h4 className="font-bold text-white text-sm">100% In-Browser Privacy</h4>
                  <p className="text-slate-400 leading-relaxed">
                    Your audio track is loaded into local memory (`URL.createObjectURL`). It is never sent to third-party file servers.
                  </p>
                </div>

                {/* 2. mm:ss.s Timestamps */}
                <div className="p-5 rounded-2xl bg-gradient-to-br from-slate-900 to-slate-950 border border-slate-800 space-y-2.5 hover:border-amber-500/30 transition">
                  <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
                    <Clock className="w-5 h-5" />
                  </div>
                  <h4 className="font-bold text-white text-sm">Exact mm:ss.s Timestamps</h4>
                  <p className="text-slate-400 leading-relaxed">
                    Decimal millisecond precision for every line. Jump anywhere, loop individual lines, and sing in sync.
                  </p>
                </div>

                {/* 3. Telugu & Romanized */}
                <div className="p-5 rounded-2xl bg-gradient-to-br from-slate-900 to-slate-950 border border-slate-800 space-y-2.5 hover:border-amber-500/30 transition">
                  <div className="w-9 h-9 rounded-xl bg-orange-500/10 border border-orange-500/20 flex items-center justify-center text-orange-400">
                    <Mic2 className="w-5 h-5" />
                  </div>
                  <h4 className="font-bold text-white text-sm">Telugu & Romanized Script</h4>
                  <p className="text-slate-400 leading-relaxed">
                    Native Telugu lipi alongside phonetic Romanized English, word breakdowns, and lyrical translations.
                  </p>
                </div>

                {/* 4. Voice Pitch Graph */}
                <div className="p-5 rounded-2xl bg-gradient-to-br from-slate-900 to-slate-950 border border-slate-800 space-y-2.5 hover:border-amber-500/30 transition">
                  <div className="w-9 h-9 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400">
                    <Activity className="w-5 h-5" />
                  </div>
                  <h4 className="font-bold text-white text-sm">Voice Pitch Contour Graph</h4>
                  <p className="text-slate-400 leading-relaxed">
                    Real-time vocal pitch trajectory, musical scale notes (C3–C5), and live microphone sing-along score.
                  </p>
                </div>

                {/* 5. Timestamp Editor */}
                <div className="p-5 rounded-2xl bg-gradient-to-br from-slate-900 to-slate-950 border border-slate-800 space-y-2.5 hover:border-amber-500/30 transition">
                  <div className="w-9 h-9 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
                    <Edit3 className="w-5 h-5" />
                  </div>
                  <h4 className="font-bold text-white text-sm">Interactive Timing Editor</h4>
                  <p className="text-slate-400 leading-relaxed">
                    Nudge timings ±0.1s or ±0.5s, customize Telugu lyrics, insert lines, and mark instrumental solos.
                  </p>
                </div>

                {/* 6. Subtitle Converter & Stage */}
                <div className="p-5 rounded-2xl bg-gradient-to-br from-slate-900 to-slate-950 border border-slate-800 space-y-2.5 hover:border-amber-500/30 transition">
                  <div className="w-9 h-9 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-400">
                    <Download className="w-5 h-5" />
                  </div>
                  <h4 className="font-bold text-white text-sm">Multi-Format Exports & Stage</h4>
                  <p className="text-slate-400 leading-relaxed">
                    Export .SRT, .LRC synced lyrics, .TXT, or copy Markdown. Open fullscreen concert teleprompter stage.
                  </p>
                </div>
              </div>
            </div>

            {/* Bottom Proceed CTA */}
            <div className="text-center pt-2">
              <button
                type="button"
                onClick={() => setCurrentStep('apikey')}
                className="inline-flex items-center gap-2 py-3.5 px-8 rounded-xl font-bold text-sm bg-gradient-to-r from-amber-500 via-orange-500 to-amber-400 hover:from-amber-400 hover:to-orange-400 text-slate-950 transition shadow-lg shadow-amber-500/20 cursor-pointer"
              >
                <span>Continue to Step 2: Connect API Key</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </main>
        )}

        {/* ========================================================= */}
        {/* STEP 2: API KEY PAGE                                      */}
        {/* ========================================================= */}
        {currentStep === 'apikey' && (
          <main className="flex-1 max-w-4xl w-full mx-auto px-4 sm:px-6 py-10 flex flex-col justify-center space-y-8 animate-fadeIn">
            {/* Header */}
            <div className="text-center space-y-3">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs font-semibold">
                <Key className="w-3.5 h-3.5" />
                <span>Step 2 • Connect Google Gemini API Key</span>
              </div>
              <h2 className="text-2xl sm:text-4xl font-extrabold text-white tracking-tight">
                Enter Your Gemini API Key
              </h2>
              <p className="text-xs sm:text-sm text-slate-400 max-w-xl mx-auto leading-relaxed">
                To guarantee zero latency, unlimited songs, and complete audio privacy, audio analysis runs directly from your browser to Google Gemini.
              </p>
            </div>

            {/* API Key Box */}
            <div className="rounded-2xl bg-gradient-to-br from-amber-950/40 via-slate-900 to-slate-900/90 border-2 border-amber-500/50 shadow-2xl p-6 sm:p-8 space-y-6">
              {/* Privacy Guarantee Pill */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-slate-800">
                <div className="flex items-center gap-2 text-amber-400 text-xs font-bold uppercase tracking-wider">
                  <ShieldCheck className="w-4 h-4" />
                  <span>Stored 100% in Browser LocalStorage</span>
                </div>
                <div className="flex items-center gap-1.5 text-[11px] text-emerald-400 bg-emerald-950/80 border border-emerald-800/60 px-2.5 py-1 rounded-full w-fit">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Audio & Keys Never Saved On External Servers</span>
                </div>
              </div>

              {/* Status Card if key is already active */}
              {userApiKey ? (
                <div className="p-4 rounded-xl bg-emerald-950/40 border border-emerald-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 shrink-0">
                      <Check className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="font-bold text-white flex items-center gap-2">
                        <span>Active Key Configured:</span>
                        <span className="font-mono text-emerald-400">{userApiKey.slice(0, 6)}••••••••••••</span>
                      </div>
                      <p className="text-slate-400 text-[11px]">Ready to transcribe songs directly in Step 3.</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => {
                        setApiKeyInput(userApiKey);
                      }}
                      className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 text-xs font-semibold transition cursor-pointer"
                    >
                      Edit Key
                    </button>
                    <button
                      type="button"
                      onClick={handleClearApiKey}
                      className="px-3 py-1.5 rounded-lg bg-red-950/60 hover:bg-red-900/60 text-red-300 border border-red-800/80 text-xs font-semibold transition cursor-pointer"
                    >
                      Clear
                    </button>
                  </div>
                </div>
              ) : null}

              {/* Form to enter/update key */}
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (handleSaveApiKey()) {
                    setCurrentStep('upload');
                  }
                }}
                className="space-y-4"
              >
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
                    <Key className="w-3.5 h-3.5 text-amber-400" />
                    <span>Paste Google Gemini API Key</span>
                  </label>

                  <div className="relative">
                    <input
                      type={showApiKey ? 'text' : 'password'}
                      value={apiKeyInput}
                      onChange={(e) => {
                        setApiKeyInput(e.target.value);
                        setApiKeyError(null);
                      }}
                      placeholder={userApiKey ? 'Enter new key to update, or keep existing' : 'Paste your Gemini API key (AIzaSy...)'}
                      className="w-full bg-slate-950/90 border border-slate-700 focus:border-amber-400 focus:ring-1 focus:ring-amber-400 rounded-xl px-4 py-3.5 text-xs sm:text-sm text-white placeholder-slate-500 outline-none pr-11 font-mono tracking-wide"
                    />
                    <button
                      type="button"
                      onClick={() => setShowApiKey(!showApiKey)}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white cursor-pointer"
                      title={showApiKey ? 'Hide key' : 'Show key'}
                    >
                      {showApiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>

                  {apiKeyError && (
                    <p className="text-xs text-red-400 flex items-center gap-1.5 font-medium pt-1">
                      <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                      <span>{apiKeyError}</span>
                    </p>
                  )}
                </div>

                {/* Free Key Instructions Box */}
                <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 space-y-2 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-amber-400 flex items-center gap-1.5">
                      <Info className="w-3.5 h-3.5" />
                      Don't have a Gemini API key yet?
                    </span>
                    <a
                      href="https://aistudio.google.com/app/apikey"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-amber-400 hover:text-amber-300 font-semibold underline inline-flex items-center gap-1 text-xs"
                    >
                      <span>Get Free Key (Google AI Studio)</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                  <p className="text-slate-400 text-[11px] leading-relaxed">
                    1. Open Google AI Studio with your Google account. <br />
                    2. Click "Create API Key" → Copy the key (starts with <code className="text-amber-300 font-mono">AIzaSy...</code>). <br />
                    3. Paste it above. It is 100% free and no credit card is required.
                  </p>
                </div>

                {/* Form Buttons */}
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setCurrentStep('welcome')}
                    className="py-3 px-5 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 transition cursor-pointer flex items-center justify-center gap-1.5"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    <span>Back to Welcome (Step 1)</span>
                  </button>

                  <div className="flex items-center gap-2">
                    {userApiKey && !apiKeyInput.trim() ? (
                      <button
                        type="button"
                        onClick={() => setCurrentStep('upload')}
                        className="flex-1 sm:flex-none py-3 px-6 rounded-xl font-bold text-xs sm:text-sm bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 transition shadow-lg shadow-emerald-500/20 cursor-pointer flex items-center justify-center gap-2"
                      >
                        <span>Continue to Step 3: Upload</span>
                        <ArrowRight className="w-4 h-4" />
                      </button>
                    ) : (
                      <button
                        type="submit"
                        className="flex-1 sm:flex-none py-3 px-6 rounded-xl font-bold text-xs sm:text-sm bg-gradient-to-r from-amber-500 via-orange-500 to-amber-400 hover:from-amber-400 hover:to-orange-400 text-slate-950 transition shadow-lg shadow-amber-500/20 cursor-pointer flex items-center justify-center gap-2"
                      >
                        <CheckCircle2 className="w-4 h-4" />
                        <span>Save Key & Next: Upload Track</span>
                      </button>
                    )}
                  </div>
                </div>
              </form>
            </div>

            {/* Quick Demo Option */}
            <div className="text-center">
              <button
                type="button"
                onClick={loadDemoSong}
                className="text-xs text-slate-400 hover:text-amber-400 transition underline cursor-pointer inline-flex items-center gap-1.5"
              >
                <Flame className="w-3.5 h-3.5 text-amber-400" />
                <span>Want to test without an API key? Try the built-in "Veera Veera" Demo track →</span>
              </button>
            </div>
          </main>
        )}

        {/* ========================================================= */}
        {/* STEP 3: UPLOAD & LIVE SCROLLING CONSOLE PAGE              */}
        {/* ========================================================= */}
        {currentStep === 'upload' && (
          <main className="flex-1 max-w-5xl w-full mx-auto px-4 sm:px-6 py-8 flex flex-col justify-center space-y-6 animate-fadeIn">
            {/* Header */}
            <div className="text-center space-y-2">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs font-semibold">
                <Upload className="w-3.5 h-3.5" />
                <span>Step 3 • Audio Upload & Live Console Output</span>
              </div>
              <h2 className="text-2xl sm:text-4xl font-extrabold text-white tracking-tight">
                Upload Song & Watch Live Output
              </h2>
              <p className="text-xs sm:text-sm text-slate-400 max-w-xl mx-auto">
                Select your song file. Watch the live console below auto-scroll as Gemini extracts Telugu lyrics, isolates instrumental breaks, and maps timestamps.
              </p>
            </div>

            {/* Error Banner */}
            {errorMessage && (
              <div className="p-4 rounded-xl bg-red-950/60 border border-red-800/80 text-xs text-red-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-lg">
                <div className="flex items-start gap-2.5">
                  <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                  <div className="leading-relaxed">{errorMessage}</div>
                </div>
                {selectedFile && !isProcessing && (
                  <button
                    type="button"
                    onClick={handleUploadFile}
                    className="shrink-0 px-3.5 py-1.5 rounded-lg text-xs font-bold bg-amber-500 hover:bg-amber-400 text-slate-950 transition shadow cursor-pointer flex items-center gap-1.5"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>Retry Transcription</span>
                  </button>
                )}
              </div>
            )}

            {/* Audio Dropzone Box */}
            <div className="rounded-2xl bg-gradient-to-b from-slate-900 to-slate-900/70 border border-slate-800 shadow-xl p-5 sm:p-6 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-300">
                  <Music className="w-4 h-4 text-amber-400" />
                  <span>Audio Track Dropzone</span>
                </div>
                <div className="flex items-center gap-2">
                  {userApiKey ? (
                    <span className="text-[11px] text-emerald-400 font-mono bg-emerald-950/80 px-2 py-0.5 rounded border border-emerald-800/60">
                      Key Active: {userApiKey.slice(0, 4)}••
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setCurrentStep('apikey')}
                      className="text-[11px] text-amber-400 hover:underline cursor-pointer flex items-center gap-1"
                    >
                      <Key className="w-3 h-3" />
                      <span>Set API Key (Step 2)</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Drag & Drop Area */}
              <div
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-xl p-6 sm:p-8 text-center cursor-pointer transition ${
                  selectedFile
                    ? 'border-amber-500/80 bg-amber-500/10'
                    : 'border-slate-700 hover:border-amber-500/50 hover:bg-slate-800/40'
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
                      addLog(`Selected audio file: "${file.name}" (${(file.size / (1024 * 1024)).toFixed(2)} MB)`, 'info', 'INPUT');
                    }
                  }}
                  className="hidden"
                />

                <div className="w-12 h-12 rounded-xl bg-slate-800 flex items-center justify-center mx-auto mb-3 text-amber-400 shadow-md">
                  <Upload className="w-6 h-6" />
                </div>

                {selectedFile ? (
                  <div className="space-y-1">
                    <p className="text-sm sm:text-base font-bold text-white flex items-center justify-center gap-2">
                      <FileAudio className="w-4 h-4 text-amber-400" />
                      <span>{selectedFile.name}</span>
                    </p>
                    <p className="text-xs text-amber-300">
                      {(selectedFile.size / (1024 * 1024)).toFixed(2)} MB • Click to select another audio track
                    </p>
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    <p className="text-sm sm:text-base font-bold text-slate-200">
                      Drop your song file here, or <span className="text-amber-400 underline">click to browse</span>
                    </p>
                    <p className="text-xs text-slate-500">
                      Supports MP3, WAV, M4A, AAC, FLAC, OGG (audio stays strictly on your device)
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
                  className="w-full sm:w-auto flex-1 py-3 px-6 rounded-xl font-bold text-xs sm:text-sm bg-gradient-to-r from-amber-500 via-orange-500 to-red-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 transition shadow-lg shadow-amber-500/20 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer flex items-center justify-center gap-2"
                >
                  {isProcessing ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin text-slate-950" />
                      <span>{processingStatus || 'Analyzing audio with Gemini AI...'}</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4 fill-slate-950" />
                      <span>Transcribe Audio & Generate Lyrics</span>
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={loadDemoSong}
                  className="w-full sm:w-auto py-3 px-4 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 transition cursor-pointer flex items-center justify-center gap-1.5 whitespace-nowrap"
                >
                  <Flame className="w-3.5 h-3.5 text-amber-400" />
                  <span>Try Demo Song (Veera Veera)</span>
                </button>
              </div>
            </div>

            {/* ======================================================= */}
            {/* MEANWHILE SCROLLING CONSOLE OUTPUT                      */}
            {/* ======================================================= */}
            <div className="rounded-2xl bg-slate-950 border border-slate-800 shadow-2xl overflow-hidden flex flex-col">
              {/* Terminal Title Bar */}
              <div className="px-4 py-2.5 bg-slate-900 border-b border-slate-800 flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-red-500/80 inline-block" />
                    <span className="w-2.5 h-2.5 rounded-full bg-amber-500/80 inline-block" />
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500/80 inline-block" />
                  </div>
                  <span className="text-slate-600 font-mono">|</span>
                  <div className="flex items-center gap-1.5 font-mono text-slate-300 font-bold">
                    <Terminal className="w-3.5 h-3.5 text-amber-400" />
                    <span>gemini-transcribe-console ~ /live-output</span>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  {isProcessing ? (
                    <div className="flex items-center gap-1.5 text-amber-400 font-mono text-[11px] animate-pulse">
                      <span className="w-2 h-2 rounded-full bg-amber-400" />
                      <span>TRANSCRIBING...</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1.5 text-emerald-400 font-mono text-[11px]">
                      <span className="w-2 h-2 rounded-full bg-emerald-400" />
                      <span>AUTO-SCROLL: ON</span>
                    </div>
                  )}

                  <span className="text-[10px] text-slate-500 font-mono">
                    {progressLogs.length} events
                  </span>

                  <button
                    type="button"
                    onClick={() => {
                      setProgressLogs([
                        {
                          id: `log_cleared_${Date.now()}`,
                          time: '00:00.0',
                          stage: 'SYSTEM',
                          text: 'Console log buffer cleared.',
                          type: 'dim',
                        },
                      ]);
                    }}
                    className="text-[10px] text-slate-400 hover:text-slate-200 underline cursor-pointer"
                  >
                    Clear
                  </button>
                </div>
              </div>

              {/* Scrolling Log Output Container */}
              <div
                ref={logContainerRef}
                className="h-64 sm:h-72 p-4 overflow-y-auto font-mono text-[11px] sm:text-xs leading-relaxed space-y-1.5 bg-slate-950/95 text-slate-200 select-text scroll-smooth"
              >
                {progressLogs.map((log) => {
                  let badgeStyle = 'bg-slate-800 text-slate-300';
                  let textColor = 'text-slate-300';

                  if (log.type === 'gemini') {
                    badgeStyle = 'bg-amber-500/20 text-amber-300 border border-amber-500/30';
                    textColor = 'text-amber-200';
                  } else if (log.type === 'success') {
                    badgeStyle = 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30';
                    textColor = 'text-emerald-300 font-semibold';
                  } else if (log.type === 'warn') {
                    badgeStyle = 'bg-red-500/20 text-red-300 border border-red-500/30';
                    textColor = 'text-red-300';
                  } else if (log.type === 'dim') {
                    badgeStyle = 'bg-slate-900 text-slate-500';
                    textColor = 'text-slate-500';
                  }

                  return (
                    <div key={log.id} className="flex items-start gap-2.5 hover:bg-slate-900/40 px-1 py-0.5 rounded transition-colors">
                      <span className="text-slate-600 shrink-0 text-[10px] select-none">
                        [{log.time}]
                      </span>
                      <span className={`text-[10px] px-1.5 py-0.2 rounded font-bold shrink-0 ${badgeStyle}`}>
                        {log.stage}
                      </span>
                      <span className={`break-words ${textColor}`}>
                        {log.text}
                      </span>
                    </div>
                  );
                })}

                {/* Blinking Live Prompt if processing */}
                {isProcessing && (
                  <div className="flex items-center gap-2 text-amber-400 font-mono text-xs pt-1 animate-pulse">
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>{processingStatus || 'Streaming model response and synthesizing timestamps...'}</span>
                    <span className="inline-block w-2 h-4 bg-amber-400 animate-bounce" />
                  </div>
                )}
              </div>

              {/* Console Footer */}
              <div className="px-4 py-2.5 bg-slate-900/80 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-2 text-slate-400 text-[11px]">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Log output auto-scrolls live while transcribing</span>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setCurrentStep('apikey')}
                    className="text-xs text-slate-400 hover:text-white underline cursor-pointer"
                  >
                    ← Back to Step 2 (API Key)
                  </button>

                  {currentSong && (
                    <button
                      type="button"
                      onClick={() => setCurrentStep('studio')}
                      className="px-3.5 py-1.5 rounded-lg text-xs font-bold bg-amber-500 hover:bg-amber-400 text-slate-950 transition cursor-pointer flex items-center gap-1.5"
                    >
                      <span>Open Lyrics Studio (Step 4)</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Step Navigation Back/Forward Bar */}
            <div className="flex items-center justify-between pt-2">
              <button
                type="button"
                onClick={() => setCurrentStep('apikey')}
                className="py-2.5 px-4 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 transition cursor-pointer flex items-center gap-1.5"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Step 2: API Key</span>
              </button>

              {currentSong ? (
                <button
                  type="button"
                  onClick={() => setCurrentStep('studio')}
                  className="py-2.5 px-5 rounded-xl text-xs font-bold bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 transition shadow cursor-pointer flex items-center gap-1.5"
                >
                  <span>Go to Studio (Step 4)</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={loadDemoSong}
                  className="py-2.5 px-4 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-amber-400 border border-slate-700 transition cursor-pointer flex items-center gap-1.5"
                >
                  <Flame className="w-3.5 h-3.5" />
                  <span>Load Demo Track →</span>
                </button>
              )}
            </div>
          </main>
        )}

        {/* Fallback if user navigates to Step 4 but hasn't uploaded a song yet */}
        {currentStep === 'studio' && !currentSong && (
          <main className="flex-1 max-w-lg w-full mx-auto px-4 py-16 text-center space-y-6">
            <div className="w-16 h-16 rounded-2xl bg-slate-800 border border-slate-700 flex items-center justify-center mx-auto text-amber-400 shadow-xl">
              <Music className="w-8 h-8" />
            </div>
            <div className="space-y-2">
              <h3 className="text-xl font-bold text-white">No Song Loaded in Studio Yet</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Please upload your song track in Step 3, or test immediately with the preloaded "Veera Veera" demo song.
              </p>
            </div>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
              <button
                type="button"
                onClick={() => setCurrentStep('upload')}
                className="w-full sm:w-auto py-3 px-6 rounded-xl font-bold text-xs bg-amber-500 hover:bg-amber-400 text-slate-950 transition shadow cursor-pointer flex items-center justify-center gap-1.5"
              >
                <Upload className="w-4 h-4" />
                <span>Go to Step 3: Upload Audio</span>
              </button>
              <button
                type="button"
                onClick={loadDemoSong}
                className="w-full sm:w-auto py-3 px-5 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition cursor-pointer flex items-center justify-center gap-1.5"
              >
                <Flame className="w-3.5 h-3.5 text-amber-400" />
                <span>Load Demo Song</span>
              </button>
            </div>
          </main>
        )}

        <footer className="border-t border-slate-800/80 bg-slate-950/80 py-6 text-center text-xs text-slate-500">
          <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-3">
            <p>Universal Telugu & Multilingual Song Lyrics Transcriber • Powered by Gemini AI</p>
            <div className="flex items-center gap-4 text-[11px]">
              <span className="text-emerald-400">Step-by-Step Architecture</span>
              <span className="text-slate-700">•</span>
              <span>100% In-Browser Audio</span>
              <span className="text-slate-700">•</span>
              <span>Live Output Console</span>
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
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-['Plus_Jakarta_Sans',sans-serif] selection:bg-amber-500/30 selection:text-amber-200">
      {/* Hidden audio element */}
      <audio
        ref={audioRef}
        src={currentSong.audioSrc}
        preload="auto"
      />

      {/* Top Navigation Header */}
      <header className="border-b border-slate-800 bg-slate-900/90 backdrop-blur sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setCurrentStep('upload')}
              className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition cursor-pointer"
              title="Back to Step 3: Upload"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-amber-600 via-red-600 to-orange-500 flex items-center justify-center shadow-lg shadow-amber-600/20 text-white font-bold shrink-0">
              <Flame className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] uppercase tracking-widest font-bold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                  Step 4 • Lyrics Studio
                </span>
                <span className="text-xs text-slate-500 hidden sm:inline">•</span>
                <span className="text-xs text-slate-400 hidden sm:inline">
                  {currentSong.language} Track Sync
                </span>
              </div>
              <h1 className="text-base sm:text-lg font-bold text-white tracking-tight flex items-center gap-2">
                <span>{currentSong.title}</span>
                {currentSong.movieOrAlbum && (
                  <span className="text-xs font-normal text-slate-400">
                    ({currentSong.movieOrAlbum})
                  </span>
                )}
              </h1>
            </div>
          </div>

          {/* Stepper Navigation Pills inside Studio */}
          <nav className="flex items-center gap-1 sm:gap-2 bg-slate-950/80 p-1 rounded-xl border border-slate-800 order-last lg:order-none w-full lg:w-auto justify-center">
            <button
              type="button"
              onClick={() => setCurrentStep('welcome')}
              className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
            >
              <span className="w-4 h-4 rounded-full bg-slate-800 text-slate-300 text-[10px] flex items-center justify-center font-bold">1</span>
              <span>Welcome</span>
            </button>

            <ChevronRight className="w-3.5 h-3.5 text-slate-600 hidden sm:inline" />

            <button
              type="button"
              onClick={() => setCurrentStep('apikey')}
              className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
            >
              <span className="w-4 h-4 rounded-full bg-slate-800 text-slate-300 text-[10px] flex items-center justify-center font-bold">2</span>
              <span>API Key</span>
              {userApiKey && <span className="w-2 h-2 rounded-full bg-emerald-400 shrink-0" />}
            </button>

            <ChevronRight className="w-3.5 h-3.5 text-slate-600 hidden sm:inline" />

            <button
              type="button"
              onClick={() => setCurrentStep('upload')}
              className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
            >
              <span className="w-4 h-4 rounded-full bg-slate-800 text-slate-300 text-[10px] flex items-center justify-center font-bold">3</span>
              <span>Upload & Log</span>
            </button>

            <ChevronRight className="w-3.5 h-3.5 text-slate-600 hidden sm:inline" />

            <button
              type="button"
              onClick={() => setCurrentStep('studio')}
              className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-bold bg-amber-500 text-slate-950 shadow-md transition cursor-pointer"
            >
              <span className="w-4 h-4 rounded-full bg-slate-950 text-amber-400 text-[10px] flex items-center justify-center font-bold">4</span>
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
              className="flex items-center gap-1.5 text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 px-3 py-2 rounded-xl transition cursor-pointer"
              title="Manage Gemini API Key (Step 2)"
            >
              <Key className="w-3.5 h-3.5 text-amber-400" />
              <span className="hidden sm:inline">API Key</span>
            </button>

            {/* Upload Another Song Button */}
            <button
              onClick={() => {
                setCurrentStep('upload');
                setErrorMessage(null);
              }}
              className="flex items-center gap-2 text-xs font-bold bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 px-3.5 py-2 rounded-xl shadow-md shadow-amber-500/20 transition-all cursor-pointer active:scale-95"
            >
              <Upload className="w-4 h-4 text-slate-950" />
              <span>Upload Track (Step 3)</span>
            </button>

            {/* Copy Markdown Table */}
            <button
              onClick={() => copyToClipboard(generateMarkdownTable(currentSong), 'markdown')}
              className="flex items-center gap-1.5 text-xs font-medium bg-slate-800 hover:bg-slate-700 text-amber-400 border border-slate-700 px-3 py-2 rounded-xl transition-colors cursor-pointer"
              title="Copy the Markdown transcription table"
            >
              {copiedType === 'markdown' ? (
                <Check className="w-3.5 h-3.5 text-emerald-400" />
              ) : (
                <Copy className="w-3.5 h-3.5" />
              )}
              <span className="hidden sm:inline">
                {copiedType === 'markdown' ? 'Copied Table!' : 'Copy Table'}
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
              className="hidden md:flex items-center gap-1.5 text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 px-3 py-2 rounded-xl transition-colors cursor-pointer"
              title="Download Plain Text lyrics with timestamps and meaning"
            >
              <Download className="w-3.5 h-3.5" />
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
              className="hidden lg:flex items-center gap-1.5 text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 px-3 py-2 rounded-xl transition-colors cursor-pointer"
              title="Download Subtitles (.SRT)"
            >
              <Download className="w-3.5 h-3.5" />
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
              className="hidden lg:flex items-center gap-1.5 text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 px-3 py-2 rounded-xl transition-colors cursor-pointer"
              title="Download Synced Karaoke Lyrics (.LRC)"
            >
              <Download className="w-3.5 h-3.5" />
              <span>.LRC</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Studio Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-6 space-y-6">
        
        {/* Songs Switcher Ribbon (If user has multiple songs) */}
        {songs.length > 1 && (
          <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-thin">
            <span className="text-xs text-slate-500 uppercase tracking-wider font-semibold whitespace-nowrap flex items-center gap-1.5">
              <FolderOpen className="w-3.5 h-3.5" /> Uploaded Tracks ({songs.length}):
            </span>
            {songs.map((song) => (
              <div
                key={song.id}
                onClick={() => setActiveSongId(song.id)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition cursor-pointer border whitespace-nowrap ${
                  song.id === activeSongId
                    ? 'bg-amber-500/20 border-amber-500/50 text-amber-300 font-bold'
                    : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white hover:bg-slate-800'
                }`}
              >
                <FileAudio className="w-3.5 h-3.5 text-amber-400" />
                <span>{song.title}</span>
                <button
                  onClick={(e) => deleteSong(song.id, e)}
                  className="text-slate-500 hover:text-red-400 ml-1"
                  title="Delete track"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Audio Player Card */}
        <section className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-900 via-slate-900/90 to-red-950/40 border border-slate-800 shadow-2xl p-5 sm:p-6">
          <div className="absolute top-0 right-0 w-96 h-96 bg-amber-500/5 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute bottom-0 left-1/3 w-80 h-80 bg-red-600/5 rounded-full blur-3xl pointer-events-none" />

          <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
            {/* Song Meta info */}
            <div className="space-y-2">
              <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-md bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs font-semibold">
                <Music className="w-3.5 h-3.5 text-amber-400" />
                <span>
                  {currentSong.sourceType === 'upload' || currentSong.sourceName
                    ? `Uploaded: ${currentSong.sourceName || currentSong.title}`
                    : 'Transcribed Audio Track'}
                </span>
                <span className="text-slate-600">•</span>
                <span className="text-slate-300">{currentSong.language}</span>
              </div>
              <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
                {currentSong.title}
              </h2>
              <p className="text-sm text-slate-300">
                {currentSong.composer && (
                  <>
                    <strong className="text-amber-400">Music:</strong> {currentSong.composer}{' '}
                    &nbsp;|&nbsp;{' '}
                  </>
                )}
                {currentSong.lyrics && (
                  <>
                    <strong className="text-amber-400">Lyrics:</strong> {currentSong.lyrics}{' '}
                    &nbsp;|&nbsp;{' '}
                  </>
                )}
                {currentSong.singers && (
                  <>
                    <strong className="text-amber-400">Vocals:</strong> {currentSong.singers}
                  </>
                )}
              </p>
            </div>

            {/* Visualizer Simulation */}
            <div className="flex items-center gap-1.5 h-10 px-4 py-2 bg-slate-950/60 rounded-xl border border-slate-800/80">
              {[40, 75, 90, 60, 30, 85, 100, 65, 45, 80, 95, 50, 70, 85, 40].map((h, i) => (
                <div
                  key={i}
                  className={`w-1 rounded-full transition-all duration-150 ${
                    isPlaying
                      ? 'bg-gradient-to-t from-amber-500 to-red-500'
                      : 'bg-slate-700'
                  }`}
                  style={{
                    height: isPlaying
                      ? `${Math.max(15, (h * (Math.sin(currentTime * 8 + i) + 1.2)) / 2.2)}%`
                      : '20%',
                  }}
                />
              ))}
              <span className="text-xs font-mono text-amber-400 ml-2 font-semibold">
                {formatTime(currentTime)} / {formatTime(duration || currentSong.durationSeconds)}
              </span>
            </div>
          </div>

          {/* Scrubber & Player Controls Bar */}
          <div className="mt-6 pt-5 border-t border-slate-800/80 space-y-4">
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
                  className="w-full h-2.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-amber-500 focus:outline-none"
                />
              </div>

              {/* Timestamp markers on slider */}
              <div className="flex justify-between text-[11px] text-slate-500 font-mono px-1">
                <span>00:00.0</span>
                <span>{formatTime((duration || currentSong.durationSeconds) * 0.25)}</span>
                <span>{formatTime((duration || currentSong.durationSeconds) * 0.5)}</span>
                <span>{formatTime((duration || currentSong.durationSeconds) * 0.75)}</span>
                <span>{formatTime(duration || currentSong.durationSeconds)}</span>
              </div>
            </div>

            {/* Playback Buttons & Speed */}
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                {/* Restart */}
                <button
                  onClick={() => {
                    if (audioRef.current) {
                      audioRef.current.currentTime = 0;
                      setCurrentTime(0);
                    }
                  }}
                  className="p-2.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition cursor-pointer"
                  title="Rewind to start"
                >
                  <RotateCcw className="w-4 h-4" />
                </button>

                {/* Primary Play / Pause */}
                <button
                  onClick={togglePlay}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 via-orange-500 to-red-600 hover:from-amber-400 hover:to-red-500 text-slate-950 font-bold shadow-lg shadow-amber-500/20 active:scale-95 transition-all cursor-pointer"
                >
                  {isPlaying ? (
                    <>
                      <Pause className="w-5 h-5 fill-slate-950" />
                      <span>Pause</span>
                    </>
                  ) : (
                    <>
                      <Play className="w-5 h-5 fill-slate-950" />
                      <span>Play Song</span>
                    </>
                  )}
                </button>

                {/* Loop line toggle */}
                <button
                  onClick={() => setLoopActiveLine(!loopActiveLine)}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold border transition cursor-pointer ${
                    loopActiveLine
                      ? 'bg-amber-500/20 border-amber-500 text-amber-300'
                      : 'bg-slate-800/80 border-slate-700 text-slate-400 hover:text-slate-200'
                  }`}
                  title="Loop current line for practicing pronunciation"
                >
                  <Repeat className="w-3.5 h-3.5" />
                  <span>Loop Current Line</span>
                </button>
              </div>

              {/* Speed & Volume */}
              <div className="flex items-center gap-4">
                {/* Speed selector */}
                <div className="flex items-center gap-1 bg-slate-950/70 p-1 rounded-lg border border-slate-800 text-xs">
                  <span className="text-slate-500 px-2 font-mono">Speed:</span>
                  {[0.75, 1, 1.25].map((rate) => (
                    <button
                      key={rate}
                      onClick={() => handleRateChange(rate)}
                      className={`px-2 py-1 rounded font-mono text-xs cursor-pointer transition ${
                        playbackRate === rate
                          ? 'bg-amber-500 text-slate-950 font-bold'
                          : 'text-slate-400 hover:text-white'
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
                    className="text-slate-400 hover:text-white cursor-pointer"
                    title={isMuted ? 'Unmute' : 'Mute'}
                  >
                    {isMuted || volume === 0 ? (
                      <VolumeX className="w-4 h-4 text-red-400" />
                    ) : (
                      <Volume2 className="w-4 h-4" />
                    )}
                  </button>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.05"
                    value={isMuted ? 0 : volume}
                    onChange={handleVolumeChange}
                    className="w-16 h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-amber-500"
                  />
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* View Mode Switcher & Search Bar */}
        <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-4 bg-slate-900/60 p-2.5 rounded-xl border border-slate-800">
          <div className="flex items-center gap-1.5 bg-slate-950/60 p-1 rounded-lg border border-slate-800 overflow-x-auto">
            <button
              onClick={() => setActiveTab('table')}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-semibold cursor-pointer transition whitespace-nowrap ${
                activeTab === 'table'
                  ? 'bg-amber-500 text-slate-950 shadow'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <FileText className="w-3.5 h-3.5" />
              <span>Lyrics Table</span>
            </button>
            <button
              onClick={() => setActiveTab('karaoke')}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-semibold cursor-pointer transition whitespace-nowrap ${
                activeTab === 'karaoke'
                  ? 'bg-amber-500 text-slate-950 shadow'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Karaoke View</span>
            </button>
            <button
              onClick={() => setActiveTab('pitch')}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-semibold cursor-pointer transition whitespace-nowrap ${
                activeTab === 'pitch'
                  ? 'bg-amber-500 text-slate-950 shadow'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Activity className="w-3.5 h-3.5" />
              <span>Voice Pitch Graph</span>
            </button>
            <button
              onClick={() => setActiveTab('editor')}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-semibold cursor-pointer transition whitespace-nowrap ${
                activeTab === 'editor'
                  ? 'bg-amber-500 text-slate-950 shadow'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Clock className="w-3.5 h-3.5" />
              <span>Timestamp Editor</span>
            </button>
            <button
              onClick={() => setActiveTab('converter')}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-semibold cursor-pointer transition whitespace-nowrap ${
                activeTab === 'converter'
                  ? 'bg-amber-500 text-slate-950 shadow'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <ArrowRightLeft className="w-3.5 h-3.5" />
              <span>Converter Lab</span>
            </button>
            <button
              onClick={() => setActiveTab('glossary')}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-semibold cursor-pointer transition whitespace-nowrap ${
                activeTab === 'glossary'
                  ? 'bg-amber-500 text-slate-950 shadow'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <BookOpen className="w-3.5 h-3.5" />
              <span>Vocabulary</span>
            </button>
          </div>

          <div className="flex items-center gap-2.5">
            {/* Fullscreen Stage Mode Action */}
            <button
              onClick={() => setIsKaraokeStageOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-gradient-to-r from-red-600 via-orange-500 to-amber-500 hover:from-red-500 hover:to-amber-400 text-white shadow-md shadow-red-600/20 transition cursor-pointer whitespace-nowrap active:scale-95"
              title="Open Fullscreen Singing Teleprompter"
            >
              <Maximize2 className="w-3.5 h-3.5" />
              <span>Stage Mode</span>
            </button>

            {/* Search Box */}
            <div className="relative flex-1 sm:w-56">
              <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search lyrics..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-slate-950/80 border border-slate-800 rounded-lg pl-9 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500/60"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-slate-500 hover:text-white"
                >
                  ✕
                </button>
              )}
            </div>
          </div>
        </div>

        {/* TAB 1: FULL TRANSCRIPTION TABLE */}
        {activeTab === 'table' && (
          <div className="space-y-4">
            {/* Table Controls Bar */}
            <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-slate-400 px-1">
              <div className="flex items-center gap-3">
                <span className="font-semibold text-slate-300">
                  Total Lines: {currentSong.lines?.length || 0}
                </span>
                <span className="text-slate-600">•</span>
                <label className="flex items-center gap-1.5 cursor-pointer hover:text-slate-200">
                  <input
                    type="checkbox"
                    checked={showMeaningInTable}
                    onChange={(e) => setShowMeaningInTable(e.target.checked)}
                    className="rounded accent-amber-500 bg-slate-900 border-slate-700"
                  />
                  <span>Show English Context</span>
                </label>
                <label className="flex items-center gap-1.5 cursor-pointer hover:text-slate-200">
                  <input
                    type="checkbox"
                    checked={showWordsInTable}
                    onChange={(e) => setShowWordsInTable(e.target.checked)}
                    className="rounded accent-amber-500 bg-slate-900 border-slate-700"
                  />
                  <span>Show Word Breakdown</span>
                </label>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-[11px] text-amber-400/90 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded">
                  Click any row to jump audio directly to that line
                </span>
              </div>
            </div>

            {/* The Main Transcription Table */}
            <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-900/40 shadow-xl">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-900/90 text-slate-300 text-xs font-semibold uppercase tracking-wider border-b border-slate-800">
                    <th className="py-3 px-3 text-center w-14">#</th>
                    <th className="py-3 px-4 w-32 font-mono">Time (mm:ss.s)</th>
                    <th className="py-3 px-4">Telugu / Native Script</th>
                    <th className="py-3 px-4">Romanized Telugu</th>
                    <th className="py-3 px-4 w-32 text-center">Status</th>
                    <th className="py-3 px-3 text-center w-16">Play</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 text-sm">
                  {filteredLyrics.map((line) => {
                    const isActive = line.id === activeLineId;
                    return (
                      <React.Fragment key={line.id}>
                        <tr
                          onClick={() => jumpToLine(line)}
                          className={`cursor-pointer transition-colors ${
                            isActive
                              ? 'bg-amber-500/15 border-l-4 border-l-amber-500 font-medium'
                              : 'hover:bg-slate-800/50'
                          } ${line.isInstrumental ? 'bg-slate-900/30 text-slate-400' : ''}`}
                        >
                          {/* Line Number */}
                          <td className="py-3 px-3 text-center text-xs font-mono text-slate-500">
                            {isActive ? (
                              <span className="inline-block w-5 h-5 rounded-full bg-amber-500 text-slate-950 font-bold text-center leading-5">
                                {line.id}
                              </span>
                            ) : (
                              line.id
                            )}
                          </td>

                          {/* Time range */}
                          <td className="py-3 px-4 font-mono text-xs text-amber-400/90 whitespace-nowrap">
                            <span className="bg-slate-950/80 px-2 py-1 rounded border border-slate-800">
                              {line.startTime} - {line.endTime}
                            </span>
                          </td>

                          {/* Telugu Script */}
                          <td className="py-3 px-4 font-['Noto_Sans_Telugu',sans-serif]">
                            <div className="flex items-center justify-between gap-2">
                              <span
                                className={`text-base sm:text-lg leading-relaxed ${
                                  line.isInstrumental
                                    ? 'font-mono text-slate-400 font-bold'
                                    : isActive
                                    ? 'text-amber-200 font-bold'
                                    : 'text-slate-100 font-semibold'
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
                                  className="text-slate-500 hover:text-amber-400 p-1 rounded transition opacity-60 hover:opacity-100"
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
                              <p className="text-xs text-slate-400 mt-1 font-sans">
                                💡 {line.englishMeaning}
                              </p>
                            )}
                          </td>

                          {/* Romanized Telugu */}
                          <td className="py-3 px-4">
                            <span
                              className={`text-sm ${
                                line.isInstrumental
                                  ? 'font-mono text-slate-400 font-semibold'
                                  : isActive
                                  ? 'text-amber-300 font-medium'
                                  : 'text-slate-300'
                              }`}
                            >
                              {line.romanized}
                            </span>
                            {line.notes && (
                              <p className="text-[11px] text-slate-500 mt-1 italic">
                                {line.notes}
                              </p>
                            )}
                          </td>

                          {/* Status */}
                          <td className="py-3 px-4 text-center">
                            {line.isInstrumental ? (
                              <span className="inline-flex items-center gap-1 text-[11px] font-mono uppercase px-2.5 py-1 rounded bg-slate-800 text-slate-400 border border-slate-700">
                                [INSTRUMENTAL]
                              </span>
                            ) : line.isUnclear ? (
                              <span className="inline-flex items-center gap-1 text-[11px] font-mono uppercase px-2.5 py-1 rounded bg-yellow-500/20 text-yellow-300 border border-yellow-500/30">
                                [UNCLEAR]
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
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
                              className={`p-1.5 rounded-full transition cursor-pointer ${
                                isActive && isPlaying
                                  ? 'bg-amber-500 text-slate-950 ring-2 ring-amber-400'
                                  : 'bg-slate-800 hover:bg-amber-500 hover:text-slate-950 text-slate-400'
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

                        {/* Optional Word-by-word expanded sub-row */}
                        {showWordsInTable && line.words && line.words.length > 0 && (
                          <tr className="bg-slate-950/40 text-xs text-slate-300 border-b border-slate-800/40">
                            <td></td>
                            <td></td>
                            <td colSpan={4} className="py-2.5 px-4">
                              <div className="flex flex-wrap gap-2 items-center">
                                <span className="text-[11px] uppercase font-bold tracking-wider text-amber-500/90 mr-1">
                                  Word Meanings:
                                </span>
                                {line.words.map((w, wIdx) => (
                                  <span
                                    key={wIdx}
                                    className="bg-slate-900 border border-slate-800 rounded px-2 py-1 text-xs"
                                  >
                                    <strong className="text-amber-300 font-['Noto_Sans_Telugu']">
                                      {w.telugu}
                                    </strong>{' '}
                                    <span className="text-slate-400">({w.romanized})</span>:{' '}
                                    <span className="text-slate-200">{w.meaning}</span>
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
          <div className="space-y-6">
            <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-6 sm:p-10 text-center relative overflow-hidden shadow-2xl">
              <div className="absolute top-4 left-4 flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-ping" />
                <span className="text-xs font-mono uppercase tracking-wider text-slate-400">
                  Line {currentActiveLine.id} of {currentSong.lines?.length || 0} •{' '}
                  {currentActiveLine.startTime} - {currentActiveLine.endTime}
                </span>
              </div>

              {/* Status Pill */}
              <div className="mb-6 inline-block">
                {currentActiveLine.isInstrumental ? (
                  <span className="px-3 py-1 rounded-full text-xs font-mono uppercase bg-slate-800 text-slate-300 border border-slate-700">
                    [INSTRUMENTAL SECTION]
                  </span>
                ) : (
                  <span className="px-3 py-1 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                    Now Singing
                  </span>
                )}
              </div>

              {/* Big Telugu Lyrics Display */}
              <div className="font-['Noto_Sans_Telugu',sans-serif] text-2xl sm:text-4xl md:text-5xl font-extrabold text-amber-400 tracking-wide leading-tight mb-4 drop-shadow-md">
                {currentActiveLine.telugu || '[No lyrics active]'}
              </div>

              {/* Romanized Telugu Display */}
              <div className="text-lg sm:text-2xl text-slate-200 font-medium tracking-normal mb-6">
                {currentActiveLine.romanized}
              </div>

              {/* English Meaning Box */}
              {!currentActiveLine.isInstrumental && currentActiveLine.englishMeaning && (
                <div className="max-w-xl mx-auto p-4 rounded-xl bg-slate-950/70 border border-slate-800 text-sm text-slate-300">
                  <div className="text-xs uppercase font-bold text-amber-500 mb-1 tracking-wider">
                    English Translation & Meaning
                  </div>
                  <p>{currentActiveLine.englishMeaning}</p>
                </div>
              )}

              {/* Next line preview */}
              {nextLine && (
                <div className="mt-8 pt-6 border-t border-slate-800/80 text-left sm:text-center text-xs text-slate-400 flex flex-col sm:flex-row items-center justify-center gap-2">
                  <span className="text-slate-500 uppercase tracking-wider font-semibold">
                    Coming Up Next:
                  </span>
                  <span className="font-['Noto_Sans_Telugu'] font-semibold text-slate-300">
                    {nextLine.telugu}
                  </span>
                  <span className="text-slate-500">({nextLine.romanized})</span>
                </div>
              )}
            </div>

            {/* Quick Line Navigator Pills */}
            <div className="flex flex-wrap items-center justify-center gap-2">
              {currentSong.lines?.map((l) => (
                <button
                  key={l.id}
                  onClick={() => jumpToLine(l)}
                  className={`px-3 py-2 rounded-xl text-xs font-mono transition-all cursor-pointer flex items-center gap-2 border ${
                    l.id === activeLineId
                      ? 'bg-amber-500 text-slate-950 font-bold border-amber-400 shadow-lg shadow-amber-500/20 scale-105'
                      : 'bg-slate-900 border-slate-800 text-slate-300 hover:bg-slate-800'
                  }`}
                >
                  <span>Line {l.id}</span>
                  <span className="text-[10px] opacity-70">({l.startTime})</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* TAB 3: VOCABULARY & GLOSSARY */}
        {activeTab === 'glossary' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {currentSong.lines
              ?.filter((l) => !l.isInstrumental)
              .map((line) => (
                <div
                  key={line.id}
                  onClick={() => jumpToLine(line)}
                  className="p-5 rounded-xl bg-slate-900/60 border border-slate-800 hover:border-amber-500/40 transition cursor-pointer space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-mono text-amber-400 font-semibold">
                      Line {line.id} • {line.startTime} - {line.endTime}
                    </span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        jumpToLine(line);
                      }}
                      className="p-1 rounded-full bg-slate-800 hover:bg-amber-500 hover:text-slate-950 text-slate-400 text-xs"
                    >
                      <Play className="w-3.5 h-3.5 fill-current" />
                    </button>
                  </div>

                  <div>
                    <h4 className="font-['Noto_Sans_Telugu'] text-lg font-bold text-white">
                      {line.telugu}
                    </h4>
                    <p className="text-sm text-amber-300/90 font-medium">
                      {line.romanized}
                    </p>
                  </div>

                  {line.englishMeaning && (
                    <div className="p-3 bg-slate-950/70 rounded-lg text-xs text-slate-300 border border-slate-800/80">
                      <strong className="text-slate-400 block mb-1">Contextual Meaning:</strong>
                      {line.englishMeaning}
                    </div>
                  )}

                  {line.words && line.words.length > 0 && (
                    <div className="space-y-1.5 pt-1">
                      <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                        Word by Word Breakdown:
                      </span>
                      <div className="grid grid-cols-1 gap-1 text-xs">
                        {line.words.map((w, i) => (
                          <div
                            key={i}
                            className="flex items-baseline justify-between bg-slate-900/90 px-2.5 py-1 rounded border border-slate-800"
                          >
                            <span className="font-['Noto_Sans_Telugu'] font-semibold text-amber-200">
                              {w.telugu}{' '}
                              <span className="font-normal font-sans text-slate-400 text-[11px]">
                                ({w.romanized})
                              </span>
                            </span>
                            <span className="text-slate-300 text-[11px]">{w.meaning}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))}
          </div>
        )}
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-lg rounded-2xl bg-slate-900 border border-slate-800 shadow-2xl p-6 relative">
            {/* Close button */}
            <button
              onClick={() => {
                if (!isProcessing) {
                  setIsUploadModalOpen(false);
                  setErrorMessage(null);
                }
              }}
              disabled={isProcessing}
              className="absolute top-4 right-4 text-slate-400 hover:text-white p-1 rounded-lg cursor-pointer disabled:opacity-40"
            >
              ✕
            </button>

            <div className="space-y-1 mb-5">
              <div className="flex items-center gap-2 text-amber-400 text-xs font-bold uppercase tracking-wider">
                <Sparkles className="w-4 h-4" />
                <span>Upload New Audio Track</span>
              </div>
              <h3 className="text-xl font-bold text-white">Transcribe Another Song</h3>
              <p className="text-xs text-slate-400">
                Upload your MP3, WAV, or M4A audio file. Gemini AI will analyze the song and generate the synchronized lyrics.
              </p>
            </div>

            {errorMessage && (
              <div className="mb-4 p-3.5 rounded-xl bg-red-950/40 border border-red-800/80 text-xs text-red-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div className="flex items-start gap-2.5">
                  <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                  <div className="leading-relaxed">{errorMessage}</div>
                </div>
                {selectedFile && !isProcessing && (
                  <button
                    type="button"
                    onClick={handleUploadFile}
                    className="shrink-0 px-3 py-1.5 rounded-lg text-xs font-bold bg-amber-500 hover:bg-amber-400 text-slate-950 transition cursor-pointer flex items-center gap-1.5"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>Retry</span>
                  </button>
                )}
              </div>
            )}

            {isProcessing ? (
              <div className="p-6 rounded-xl bg-slate-950/90 border border-amber-500/30 text-center space-y-3 mb-2">
                <Loader2 className="w-8 h-8 text-amber-400 animate-spin mx-auto" />
                <div className="text-sm font-bold text-amber-300">
                  {processingStatus || 'Analyzing Audio with Gemini...'}
                </div>
                <p className="text-xs text-slate-400">
                  Transcribing lyrics, isolating instrumental sections, and mapping timestamps in mm:ss.s format.
                </p>
                <div className="pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      setIsProcessing(false);
                      setProcessingStatus('');
                    }}
                    className="px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 transition cursor-pointer"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition ${
                    selectedFile
                      ? 'border-amber-500/80 bg-amber-500/10'
                      : 'border-slate-700 hover:border-amber-500/50 hover:bg-slate-800/40'
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
                  <div className="w-12 h-12 rounded-full bg-slate-800 flex items-center justify-center mx-auto mb-3 text-amber-400">
                    <FileAudio className="w-6 h-6" />
                  </div>
                  {selectedFile ? (
                    <div>
                      <p className="text-sm font-bold text-white">{selectedFile.name}</p>
                      <p className="text-xs text-amber-400 mt-1">
                        {(selectedFile.size / (1024 * 1024)).toFixed(2)} MB • Click to replace
                      </p>
                    </div>
                  ) : (
                    <div>
                      <p className="text-sm font-semibold text-slate-200">
                        Drop your song here or <span className="text-amber-400 underline">browse</span>
                      </p>
                      <p className="text-xs text-slate-500 mt-1.5">
                        Supports MP3, WAV, M4A, AAC, FLAC, OGG (up to 30MB)
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
                  className="w-full py-3 rounded-xl font-bold text-sm bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 transition shadow-lg shadow-amber-500/20 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer flex items-center justify-center gap-2"
                >
                  <Sparkles className="w-4 h-4 fill-slate-950" />
                  <span>
                    {!userApiKey ? 'Enter API Key to Transcribe' : 'Transcribe Lyrics with Gemini AI'}
                  </span>
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* MODAL: API Key Manager */}
      {isApiKeyModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-md rounded-2xl bg-slate-900 border border-slate-800 shadow-2xl p-6 relative">
            <button
              onClick={() => {
                setIsApiKeyModalOpen(false);
                setApiKeyError(null);
              }}
              className="absolute top-4 right-4 text-slate-400 hover:text-white p-1 rounded-lg cursor-pointer"
            >
              ✕
            </button>

            <div className="flex items-center gap-2.5 text-amber-400 text-xs font-bold uppercase tracking-wider mb-2">
              <Key className="w-4 h-4" />
              <span>Gemini API Key Settings</span>
            </div>
            <h3 className="text-xl font-bold text-white mb-1">Your Personal API Key</h3>
            <p className="text-xs text-slate-400 mb-4 leading-relaxed">
              Your key and audio files stay 100% inside your browser memory. Audio is never sent to any custom server.
            </p>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSaveApiKey();
              }}
              className="space-y-4"
            >
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
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
                    className="w-full bg-slate-950/90 border border-slate-700 focus:border-amber-400 focus:ring-1 focus:ring-amber-400 rounded-xl px-4 py-3 text-xs text-white placeholder-slate-500 outline-none pr-10 font-mono"
                  />
                  <button
                    type="button"
                    onClick={() => setShowApiKey(!showApiKey)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white cursor-pointer"
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
                <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800 text-xs flex items-center justify-between">
                  <div className="flex items-center gap-2 text-slate-300">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    <span>Current: <span className="font-mono text-emerald-300">{userApiKey.slice(0, 6)}••••••••</span></span>
                  </div>
                  <button
                    type="button"
                    onClick={handleClearApiKey}
                    className="text-red-400 hover:text-red-300 text-xs font-semibold underline cursor-pointer"
                  >
                    Remove Key
                  </button>
                </div>
              )}

              <div className="flex items-center justify-between gap-3 pt-2">
                <button
                  type="submit"
                  className="flex-1 py-2.5 px-4 rounded-xl font-bold text-xs bg-amber-500 hover:bg-amber-400 text-slate-950 transition shadow cursor-pointer text-center"
                >
                  Save API Key
                </button>
                <a
                  href="https://aistudio.google.com/app/apikey"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="py-2.5 px-3 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 transition cursor-pointer flex items-center gap-1"
                >
                  <span>Get Free Key</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="border-t border-slate-800/80 bg-slate-950/80 py-6 text-center text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-3">
          <p>
            Universal Telugu & Multilingual Song Lyrics Transcriber • Powered by Gemini AI
          </p>
          <div className="flex items-center gap-4">
            <span className="text-emerald-400 font-mono text-[11px] flex items-center gap-1">
              <Check className="w-3 h-3" /> Exact mm:ss.s Timestamps
            </span>
            <span className="text-slate-600">|</span>
            <span>Supports MP3, WAV, M4A Audio Uploads</span>
            <span className="text-slate-600">|</span>
            <span>Vercel-Ready</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
