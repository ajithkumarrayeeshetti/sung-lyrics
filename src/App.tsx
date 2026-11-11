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
  PlusCircle,
  X,
  FileAudio,
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

const STORAGE_KEY = 'telugu_lyrics_songs_v2';

export default function App() {
  // Library of songs (starts with DEFAULT_SONG and loads from localStorage)
  const [songs, setSongs] = useState<SongRecord[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const hasDefault = parsed.some((s: SongRecord) => s.id === DEFAULT_SONG.id);
          return hasDefault ? parsed : [DEFAULT_SONG, ...parsed];
        }
      }
    } catch (e) {
      console.error('Failed to load songs from localStorage', e);
    }
    return [DEFAULT_SONG];
  });

  const [activeSongId, setActiveSongId] = useState<string>(DEFAULT_SONG.id);

  // Active song object
  const currentSong = useMemo(() => {
    return songs.find((s) => s.id === activeSongId) || songs[0] || DEFAULT_SONG;
  }, [songs, activeSongId]);

  // Audio player state
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(currentSong.durationSeconds || 38.56);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [loopActiveLine, setLoopActiveLine] = useState(false);
  const [activeLineId, setActiveLineId] = useState<number>(1);
  const [activeTab, setActiveTab] = useState<'table' | 'karaoke' | 'glossary'>('table');
  const [searchQuery, setSearchQuery] = useState('');
  const [copiedType, setCopiedType] = useState<string | null>(null);
  const [showMeaningInTable, setShowMeaningInTable] = useState(true);
  const [showWordsInTable, setShowWordsInTable] = useState(false);

  // Modal for Transcribing new songs
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingStatus, setProcessingStatus] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

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
      setDuration(currentSong.durationSeconds || 0);
      setActiveLineId(1);
    }
  }, [activeSongId]);

  // Audio setup and time updates
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleTimeUpdate = () => {
      const cur = audio.currentTime;
      setCurrentTime(cur);

      const lines = currentSong.lines || [];
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

  // Direct Audio File Upload Transcription (100% Vercel & Express compatible)
  const handleUploadFile = async () => {
    if (!selectedFile) {
      setErrorMessage('Please select an audio file (MP3, WAV, M4A, etc.)');
      return;
    }

    setIsProcessing(true);
    setErrorMessage(null);
    setProcessingStatus('Reading audio file...');

    try {
      // Local ObjectURL for instantaneous zero-latency playback in browser
      const localAudioUrl = URL.createObjectURL(selectedFile);

      // Convert audio file to Base64 for serverless payload
      const base64Data = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(selectedFile);
      });

      setProcessingStatus('Analyzing sung lyrics with Gemini AI...');

      // First attempt /api/transcribe (direct base64 payload, works in Vercel Serverless and Express)
      let res = await fetch('/api/transcribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          audioBase64: base64Data,
          mimeType: selectedFile.type || 'audio/mp3',
          title: selectedFile.name.replace(/\.[^/.]+$/, ''),
        }),
      });

      // If /api/transcribe returns 404, fallback to multipart /api/transcribe/upload
      if (!res.ok && res.status === 404) {
        const formData = new FormData();
        formData.append('audio', selectedFile);
        res = await fetch('/api/transcribe/upload', {
          method: 'POST',
          body: formData,
        });
      }

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || `Server error (${res.status})`);
      }

      const data = await res.json();
      if (!data.success || !data.transcription) {
        throw new Error('Invalid transcription response from server.');
      }

      const t = data.transcription;
      const newSong: SongRecord = {
        id: `song_${Date.now()}`,
        title: t.title || selectedFile.name.replace(/\.[^/.]+$/, ''),
        movieOrAlbum: t.movieOrAlbum || 'Uploaded Song',
        composer: t.composer || 'Unknown Composer',
        singers: t.artists || 'Unknown Singer',
        language: t.language || 'Telugu',
        audioSrc: data.audioUrl || localAudioUrl,
        durationSeconds: data.duration || 0,
        durationFormatted: formatTime(data.duration || 0),
        lines: t.lines || [],
        createdAt: Date.now(),
        sourceType: 'upload',
        sourceName: selectedFile.name,
      };

      setSongs((prev) => [newSong, ...prev]);
      setActiveSongId(newSong.id);
      setIsUploadModalOpen(false);
      setSelectedFile(null);
    } catch (err: any) {
      console.error(err);
      setErrorMessage(err.message || 'Failed to transcribe audio.');
    } finally {
      setIsProcessing(false);
      setProcessingStatus('');
    }
  };

  const deleteSong = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (id === DEFAULT_SONG.id) {
      alert("The default sample song cannot be deleted.");
      return;
    }
    const filtered = songs.filter((s) => s.id !== id);
    setSongs(filtered);
    if (activeSongId === id) {
      setActiveSongId(DEFAULT_SONG.id);
    }
  };

  // Filter lyrics for search
  const filteredLyrics = useMemo(() => {
    const lines = currentSong.lines || [];
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
    currentSong.lines?.find((l) => l.id === activeLineId) ||
    currentSong.lines?.[0] || {
      id: 1,
      startTime: '00:00.0',
      endTime: '00:00.0',
      startSeconds: 0,
      endSeconds: 0,
      telugu: '',
      romanized: '',
      englishMeaning: '',
    };

  const nextLine = currentSong.lines?.find((l) => l.id === activeLineId + 1);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-['Plus_Jakarta_Sans',sans-serif] selection:bg-amber-500/30 selection:text-amber-200">
      {/* Audio element for playback */}
      <audio
        ref={audioRef}
        src={currentSong.audioSrc}
        preload="auto"
      />

      {/* Top Navigation Header */}
      <header className="border-b border-slate-800 bg-slate-900/90 backdrop-blur sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-amber-600 via-red-600 to-orange-500 flex items-center justify-center shadow-lg shadow-amber-600/20 text-white font-bold">
              <Flame className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] uppercase tracking-widest font-bold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                  Telugu & Multilingual Lyrics Transcriber
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

          {/* Action Buttons & Exports */}
          <div className="flex items-center gap-2">
            {/* Upload MP3 / Audio Button */}
            <button
              onClick={() => {
                setIsUploadModalOpen(true);
                setErrorMessage(null);
              }}
              className="flex items-center gap-2 text-xs font-bold bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 px-3.5 py-2 rounded-xl shadow-md shadow-amber-500/20 transition-all cursor-pointer active:scale-95"
            >
              <Upload className="w-4 h-4 text-slate-950" />
              <span>Upload Audio File</span>
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

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-6 space-y-6">
        
        {/* Songs Switcher Ribbon */}
        {songs.length > 1 && (
          <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-thin">
            <span className="text-xs text-slate-500 uppercase tracking-wider font-semibold whitespace-nowrap flex items-center gap-1.5">
              <FolderOpen className="w-3.5 h-3.5" /> Library ({songs.length}):
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
                {song.sourceType === 'upload' ? (
                  <FileAudio className="w-3.5 h-3.5 text-amber-400" />
                ) : (
                  <Flame className="w-3.5 h-3.5 text-orange-400" />
                )}
                <span>{song.title}</span>
                {song.id !== DEFAULT_SONG.id && (
                  <button
                    onClick={(e) => deleteSong(song.id, e)}
                    className="text-slate-500 hover:text-red-400 ml-1"
                    title="Delete song"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
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
                  {songIsUploaded(currentSong)
                    ? `Uploaded Track: ${currentSong.sourceName || 'Audio File'}`
                    : 'Original Track • High Energy Action'}
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
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 bg-slate-900/60 p-2 rounded-xl border border-slate-800">
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
              <span>Full Transcription Table</span>
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
              <span>Live Karaoke View</span>
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
              <span>Vocabulary & Meaning</span>
            </button>
          </div>

          {/* Search Box */}
          <div className="relative flex-1 sm:max-w-xs">
            <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search lyrics (Script or Romanized)..."
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
      </main>

      {/* MODAL: Direct Audio File Upload & Transcription */}
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
              <X className="w-5 h-5" />
            </button>

            <div className="space-y-1 mb-5">
              <div className="flex items-center gap-2 text-amber-400 text-xs font-bold uppercase tracking-wider">
                <Sparkles className="w-4 h-4" />
                <span>Gemini Multilingual Audio Transcription</span>
              </div>
              <h3 className="text-xl font-bold text-white">Upload Audio Track</h3>
              <p className="text-xs text-slate-400">
                Upload your MP3, WAV, M4A, or audio track. Gemini AI will analyze the song and generate the synchronized Telugu & Romanized lyrics table.
              </p>
            </div>

            {/* ERROR DISPLAY */}
            {errorMessage && (
              <div className="mb-4 p-3 rounded-xl bg-red-950/40 border border-red-800/80 text-xs text-red-200 flex items-start gap-2.5">
                <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                <div className="flex-1">{errorMessage}</div>
              </div>
            )}

            {/* PROCESSING OVERLAY */}
            {isProcessing ? (
              <div className="p-6 rounded-xl bg-slate-950/90 border border-amber-500/30 text-center space-y-3 mb-2">
                <Loader2 className="w-8 h-8 text-amber-400 animate-spin mx-auto" />
                <div className="text-sm font-bold text-amber-300">
                  {processingStatus || 'Analyzing Audio with Gemini...'}
                </div>
                <p className="text-xs text-slate-400">
                  Transcribing lyrics phonetically, separating instrumental sections, and mapping timestamps in mm:ss.s format.
                </p>
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
                        {(selectedFile.size / (1024 * 1024)).toFixed(2)} MB • Click to choose another file
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
                  onClick={handleUploadFile}
                  disabled={!selectedFile || isProcessing}
                  className="w-full py-3 rounded-xl font-bold text-sm bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 transition shadow-lg shadow-amber-500/20 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                >
                  Transcribe Lyrics with Gemini AI
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="border-t border-slate-800/80 bg-slate-950/80 py-6 text-center text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-3">
          <p>
            Universal Telugu & Indian Song Lyrics Transcriber • Powered by Gemini AI
          </p>
          <div className="flex items-center gap-4">
            <span className="text-emerald-400 font-mono text-[11px] flex items-center gap-1">
              <Check className="w-3 h-3" /> Exact mm:ss.s Timestamps
            </span>
            <span className="text-slate-600">|</span>
            <span>Supports MP3, WAV, M4A & Audio Uploads</span>
            <span className="text-slate-600">|</span>
            <span>Vercel-Ready</span>
          </div>
        </div>
      </footer>
    </div>
  );
}

function songIsUploaded(song: SongRecord) {
  return song.sourceType === 'upload';
}
