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
    <div className="fixed inset-0 z-50 bg-[#09090b] flex flex-col justify-between p-4 sm:p-8 select-none overflow-y-auto sm:overflow-hidden">
      {/* Top Stage Bar */}
      <div className="relative z-10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-zinc-800/80 pb-3">
        <div className="flex items-center gap-2.5 w-full sm:w-auto justify-between sm:justify-start">
          <button
            onClick={onClose}
            className="p-2 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-300 hover:text-white border border-zinc-800 transition cursor-pointer flex items-center gap-1.5 text-xs font-medium shrink-0"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Exit Stage</span>
          </button>
          <div className="min-w-0 flex-1 sm:flex-none">
            <h2 className="text-xs sm:text-base font-semibold text-zinc-100 truncate flex items-center gap-2">
              <span className="truncate">{song.title}</span>
              {song.movieOrAlbum && <span className="text-xs text-zinc-400 font-normal hidden xs:inline">({song.movieOrAlbum})</span>}
            </h2>
            <p className="text-[11px] text-zinc-500 font-mono tabular-nums">
              Line {activeLine?.id || 1} of {lines.length}
            </p>
          </div>
        </div>

        {/* Script Toggle */}
        <div className="flex items-center self-end sm:self-auto gap-1 bg-zinc-900 p-1 rounded-lg border border-zinc-800 text-xs">
          <button
            onClick={() => setPreferRomanized(false)}
            className={`px-2.5 py-1 rounded-md font-medium text-xs transition cursor-pointer ${
              !preferRomanized ? 'bg-zinc-100 text-zinc-950 font-semibold shadow-sm' : 'text-zinc-400 hover:text-white'
            }`}
          >
            Telugu Native
          </button>
          <button
            onClick={() => setPreferRomanized(true)}
            className={`px-2.5 py-1 rounded-md font-medium text-xs transition cursor-pointer ${
              preferRomanized ? 'bg-zinc-100 text-zinc-950 font-semibold shadow-sm' : 'text-zinc-400 hover:text-white'
            }`}
          >
            Romanized
          </button>
        </div>
      </div>

      {/* Center Stage: Hero Typography */}
      <div className="relative z-10 flex-1 flex flex-col items-center justify-center text-center max-w-4xl mx-auto px-2 sm:px-4 py-6 sm:py-8 space-y-6">
        {activeLine?.isInstrumental ? (
          <div className="py-8 sm:py-12 space-y-3">
            <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-zinc-900 border border-zinc-800 flex items-center justify-center mx-auto text-zinc-400">
              <Music className="w-7 h-7 sm:w-8 sm:h-8" />
            </div>
            <div className="text-lg sm:text-2xl md:text-3xl font-bold text-zinc-200 tracking-wider">
              [INSTRUMENTAL INTERLUDE]
            </div>
            <p className="text-xs text-zinc-500">Music interlude · Vocals will resume shortly</p>
          </div>
        ) : (
          <div className="space-y-4 sm:space-y-6 w-full">
            {/* Primary Big Lyrics */}
            <div className="space-y-2 sm:space-y-3">
              <h1 className="font-['Noto_Sans_Telugu'] text-2xl sm:text-5xl md:text-6xl lg:text-7xl font-bold text-white leading-tight tracking-tight px-2 break-words">
                {preferRomanized ? activeLine?.romanized : activeLine?.telugu}
              </h1>

              {/* Secondary Subtitle Text */}
              <p className="text-base sm:text-xl md:text-2xl font-normal text-zinc-400 font-['Noto_Sans_Telugu'] px-2">
                {preferRomanized ? activeLine?.telugu : activeLine?.romanized}
              </p>

              {activeLine?.englishMeaning && (
                <p className="text-xs sm:text-sm text-zinc-500 italic max-w-xl mx-auto pt-1 px-3">
                  "{activeLine.englishMeaning}"
                </p>
              )}
            </div>

            {/* Karaoke Line Singing Progress Bar */}
            <div className="w-full max-w-xs sm:max-w-md mx-auto bg-zinc-900 h-1 sm:h-1.5 rounded-full overflow-hidden border border-zinc-800/80">
              <div
                className="h-full bg-zinc-100 transition-all duration-100 ease-linear"
                style={{ width: `${lineProgress * 100}%` }}
              />
            </div>
          </div>
        )}

        {/* Next Line Preview */}
        {nextLine && !nextLine.isInstrumental && (
          <div className="pt-4 sm:pt-6 border-t border-zinc-800/60 max-w-lg w-full space-y-1">
            <span className="text-[10px] sm:text-[11px] font-medium text-zinc-500 uppercase tracking-wider block">
              Up Next
            </span>
            <p className="text-xs sm:text-base text-zinc-400 font-['Noto_Sans_Telugu'] truncate px-2">
              {preferRomanized ? nextLine.romanized : nextLine.telugu}
            </p>
          </div>
        )}
      </div>

      {/* Bottom Floating Control Bar */}
      <div className="relative z-10 flex flex-col sm:flex-row items-center justify-between gap-3 bg-zinc-900/90 backdrop-blur border border-zinc-800 p-2.5 sm:p-3.5 rounded-xl max-w-3xl w-full mx-auto">
        <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-start">
          <button
            onClick={togglePlay}
            className="w-10 h-10 rounded-lg bg-zinc-100 hover:bg-white text-zinc-950 flex items-center justify-center transition cursor-pointer shadow-sm shrink-0"
          >
            {isPlaying ? <Pause className="w-4 h-4 fill-zinc-950" /> : <Play className="w-4 h-4 fill-zinc-950 ml-0.5" />}
          </button>

          {/* Quick jump prev/next */}
          <div className="flex items-center gap-1 overflow-x-auto max-w-[200px] xs:max-w-[280px] sm:max-w-md py-1 no-scrollbar">
            {lines.slice(Math.max(0, (activeLine?.id || 1) - 3), (activeLine?.id || 1) + 4).map((l) => (
              <button
                key={l.id}
                onClick={() => jumpToLine(l)}
                className={`px-2 py-1 rounded text-xs font-mono transition cursor-pointer shrink-0 ${
                  l.id === activeLineId
                    ? 'bg-zinc-100 text-zinc-950 font-semibold shadow-sm'
                    : 'bg-zinc-800/80 text-zinc-400 hover:text-white'
                }`}
              >
                L{l.id}
              </button>
            ))}
          </div>
        </div>

        <button
          onClick={onClose}
          className="w-full sm:w-auto text-xs font-medium text-zinc-400 hover:text-white transition px-3 py-2 sm:py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 cursor-pointer text-center"
        >
          Close Stage
        </button>
      </div>
    </div>
  );
}
