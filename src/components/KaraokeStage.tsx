import React, { useState } from 'react';
import { Play, Pause, RotateCcw, Maximize, Minimize, Volume2, Sparkles, Music, ArrowLeft } from 'lucide-react';
import type { SongRecord, LyricLine } from '../lyricsData';

interface KaraokeStageProps {
  song: SongRecord;
  currentTime: number;
  duration: number;
  isPlaying: boolean;
  activeLineId: number;
  togglePlay: () => void;
  onClose: () => void;
  jumpToLine: (line: LyricLine) => void;
}

export function KaraokeStage({
  song,
  currentTime,
  duration,
  isPlaying,
  activeLineId,
  togglePlay,
  onClose,
  jumpToLine,
}: KaraokeStageProps) {
  const [preferRomanized, setPreferRomanized] = useState(false);

  const lines = song.lines || [];
  const activeLine = lines.find((l) => l.id === activeLineId) || lines[0];
  const nextLine = lines.find((l) => l.id === activeLineId + 1);

  // Line progress fraction between start and end
  let lineProgress = 0;
  if (activeLine && activeLine.endSeconds > activeLine.startSeconds) {
    const elapsed = currentTime - activeLine.startSeconds;
    const total = activeLine.endSeconds - activeLine.startSeconds;
    lineProgress = Math.max(0, Math.min(1, elapsed / total));
  }

  return (
    <div className="fixed inset-0 z-50 bg-slate-950 flex flex-col justify-between p-6 sm:p-10 select-none overflow-hidden animate-in fade-in">
      {/* Stage Ambient Glow Effect */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-gradient-to-tr from-amber-600/10 via-red-600/15 to-orange-500/10 blur-[130px] pointer-events-none rounded-full" />

      {/* Top Stage Bar */}
      <div className="relative z-10 flex items-center justify-between border-b border-slate-800/60 pb-4">
        <div className="flex items-center gap-3">
          <button
            onClick={onClose}
            className="p-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-800 transition cursor-pointer flex items-center gap-2 text-xs font-semibold"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Exit Stage</span>
          </button>
          <div>
            <h2 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
              <span>{song.title}</span>
              {song.movieOrAlbum && <span className="text-xs text-slate-400">({song.movieOrAlbum})</span>}
            </h2>
            <p className="text-xs text-slate-400 font-mono">
              Line {activeLine?.id || 1} of {lines.length}
            </p>
          </div>
        </div>

        {/* Script Toggle */}
        <div className="flex items-center gap-2 bg-slate-900 p-1 rounded-xl border border-slate-800 text-xs">
          <button
            onClick={() => setPreferRomanized(false)}
            className={`px-3 py-1.5 rounded-lg font-semibold transition cursor-pointer ${
              !preferRomanized ? 'bg-amber-500 text-slate-950 font-bold' : 'text-slate-400 hover:text-white'
            }`}
          >
            Telugu Native
          </button>
          <button
            onClick={() => setPreferRomanized(true)}
            className={`px-3 py-1.5 rounded-lg font-semibold transition cursor-pointer ${
              preferRomanized ? 'bg-amber-500 text-slate-950 font-bold' : 'text-slate-400 hover:text-white'
            }`}
          >
            Romanized English
          </button>
        </div>
      </div>

      {/* Center Stage: Hero Glowing Lyrics */}
      <div className="relative z-10 flex-1 flex flex-col items-center justify-center text-center max-w-4xl mx-auto px-4 py-8 space-y-8">
        {activeLine?.isInstrumental ? (
          <div className="py-12 space-y-4">
            <div className="w-20 h-20 rounded-3xl bg-red-950/60 border border-red-800/80 flex items-center justify-center mx-auto text-red-400 shadow-2xl animate-pulse">
              <Music className="w-10 h-10" />
            </div>
            <div className="text-2xl sm:text-4xl font-extrabold text-red-400 tracking-wider">
              [INSTRUMENTAL SECTION]
            </div>
            <p className="text-sm text-slate-400">Music interlude • Vocals will resume shortly</p>
          </div>
        ) : (
          <div className="space-y-6 w-full">
            {/* Primary Big Lyrics */}
            <div className="space-y-4">
              <h1 className="font-['Noto_Sans_Telugu'] text-4xl sm:text-6xl md:text-7xl font-extrabold text-white leading-tight tracking-tight drop-shadow-2xl">
                {preferRomanized ? activeLine?.romanized : activeLine?.telugu}
              </h1>

              {/* Secondary Subtitle Text */}
              <p className="text-xl sm:text-3xl font-medium text-amber-300/90 font-['Noto_Sans_Telugu']">
                {preferRomanized ? activeLine?.telugu : activeLine?.romanized}
              </p>

              {activeLine?.englishMeaning && (
                <p className="text-sm sm:text-base text-slate-400 italic max-w-xl mx-auto">
                  "{activeLine.englishMeaning}"
                </p>
              )}
            </div>

            {/* Karaoke Line Singing Progress Bar */}
            <div className="w-full max-w-md mx-auto bg-slate-900 h-2.5 rounded-full overflow-hidden border border-slate-800">
              <div
                className="h-full bg-gradient-to-r from-amber-500 via-orange-500 to-red-500 transition-all duration-100 ease-linear shadow-lg"
                style={{ width: `${lineProgress * 100}%` }}
              />
            </div>
          </div>
        )}

        {/* Next Line Preview */}
        {nextLine && !nextLine.isInstrumental && (
          <div className="pt-4 opacity-50 hover:opacity-100 transition-opacity space-y-1">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-widest block">
              Up Next:
            </span>
            <p className="text-base sm:text-lg text-slate-400 font-['Noto_Sans_Telugu']">
              {preferRomanized ? nextLine.romanized : nextLine.telugu}
            </p>
          </div>
        )}
      </div>

      {/* Bottom Floating Control Bar */}
      <div className="relative z-10 flex flex-col sm:flex-row items-center justify-between gap-4 bg-slate-900/90 backdrop-blur border border-slate-800 p-4 rounded-2xl max-w-3xl w-full mx-auto shadow-2xl">
        <button
          onClick={togglePlay}
          className="w-12 h-12 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 flex items-center justify-center shadow-lg shadow-amber-500/20 transition cursor-pointer"
        >
          {isPlaying ? <Pause className="w-5 h-5 fill-slate-950" /> : <Play className="w-5 h-5 fill-slate-950 ml-0.5" />}
        </button>

        {/* Quick jump prev/next */}
        <div className="flex items-center gap-2">
          {lines.slice(Math.max(0, (activeLine?.id || 1) - 2), (activeLine?.id || 1) + 3).map((l) => (
            <button
              key={l.id}
              onClick={() => jumpToLine(l)}
              className={`px-3 py-1.5 rounded-lg text-xs font-mono transition cursor-pointer ${
                l.id === activeLineId
                  ? 'bg-amber-500 text-slate-950 font-bold shadow'
                  : 'bg-slate-800 text-slate-400 hover:text-white'
              }`}
            >
              L{l.id}
            </button>
          ))}
        </div>

        <button
          onClick={onClose}
          className="text-xs font-semibold text-slate-400 hover:text-white transition px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 cursor-pointer"
        >
          Close Stage
        </button>
      </div>
    </div>
  );
}
