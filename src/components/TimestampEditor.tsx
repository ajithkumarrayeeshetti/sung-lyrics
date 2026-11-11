import React, { useState } from 'react';
import { Save, Plus, Trash2, Clock, Check, RotateCcw, Sparkles } from 'lucide-react';
import type { SongRecord, LyricLine } from '../lyricsData';

interface TimestampEditorProps {
  song: SongRecord;
  onUpdateSong: (updatedSong: SongRecord) => void;
  jumpToLine: (line: LyricLine) => void;
}

export function TimestampEditor({ song, onUpdateSong, jumpToLine }: TimestampEditorProps) {
  const [lines, setLines] = useState<LyricLine[]>(song.lines || []);
  const [savedSuccess, setSavedSuccess] = useState(false);

  const formatSeconds = (sec: number): string => {
    const mins = Math.floor(sec / 60);
    const remSecs = (sec % 60).toFixed(1);
    return `${mins.toString().padStart(2, '0')}:${remSecs.padStart(4, '0')}`;
  };

  const nudgeStart = (index: number, delta: number) => {
    setLines((prev) => {
      const copy = [...prev];
      const line = { ...copy[index] };
      const newSec = Math.max(0, +(line.startSeconds + delta).toFixed(1));
      line.startSeconds = newSec;
      line.startTime = formatSeconds(newSec);
      if (line.endSeconds <= line.startSeconds) {
        line.endSeconds = +(line.startSeconds + 1.0).toFixed(1);
        line.endTime = formatSeconds(line.endSeconds);
      }
      copy[index] = line;
      return copy;
    });
  };

  const nudgeEnd = (index: number, delta: number) => {
    setLines((prev) => {
      const copy = [...prev];
      const line = { ...copy[index] };
      const newSec = Math.max(line.startSeconds + 0.2, +(line.endSeconds + delta).toFixed(1));
      line.endSeconds = newSec;
      line.endTime = formatSeconds(newSec);
      copy[index] = line;
      return copy;
    });
  };

  const updateField = (index: number, field: keyof LyricLine, value: any) => {
    setLines((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], [field]: value };
      return copy;
    });
  };

  const toggleInstrumental = (index: number) => {
    setLines((prev) => {
      const copy = [...prev];
      const isInst = !copy[index].isInstrumental;
      copy[index] = {
        ...copy[index],
        isInstrumental: isInst,
        telugu: isInst ? '[వాయిద్యం]' : copy[index].telugu,
        romanized: isInst ? '[INSTRUMENTAL]' : copy[index].romanized,
      };
      return copy;
    });
  };

  const addLineAfter = (index: number) => {
    const prevLine = lines[index];
    const newStart = prevLine ? +(prevLine.endSeconds + 0.1).toFixed(1) : 0;
    const newEnd = +(newStart + 3.0).toFixed(1);
    const newLine: LyricLine = {
      id: lines.length + 1,
      startTime: formatSeconds(newStart),
      endTime: formatSeconds(newEnd),
      startSeconds: newStart,
      endSeconds: newEnd,
      telugu: '',
      romanized: '',
      englishMeaning: '',
      isInstrumental: false,
    };

    const copy = [...lines];
    copy.splice(index + 1, 0, newLine);
    // re-index id numbers
    const reindexed = copy.map((l, i) => ({ ...l, id: i + 1 }));
    setLines(reindexed);
  };

  const deleteLine = (index: number) => {
    if (lines.length <= 1) return;
    const copy = lines.filter((_, i) => i !== index);
    const reindexed = copy.map((l, i) => ({ ...l, id: i + 1 }));
    setLines(reindexed);
  };

  const handleSave = () => {
    const updated: SongRecord = {
      ...song,
      lines,
    };
    onUpdateSong(updated);
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 2500);
  };

  return (
    <div className="space-y-4">
      {/* Editor Top Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-xl bg-zinc-900/50 border border-zinc-800/80">
        <div>
          <h3 className="font-semibold text-zinc-100 text-sm sm:text-base flex items-center gap-2">
            <Clock className="w-4 h-4 text-zinc-400" />
            <span>Interactive Timing & Script Workbench</span>
          </h3>
          <p className="text-xs text-zinc-400">
            Nudge timestamps by ±0.1s or ±0.5s, refine Telugu orthography, and save synchronized cues.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {savedSuccess && (
            <span className="flex items-center gap-1.5 text-xs text-emerald-400 font-medium bg-emerald-950/60 px-2.5 py-1 rounded-md border border-emerald-800/60">
              <Check className="w-3.5 h-3.5" /> Changes Saved
            </span>
          )}
          <button
            type="button"
            onClick={handleSave}
            className="px-4 py-2 rounded-lg text-xs font-semibold bg-zinc-100 hover:bg-white text-zinc-950 transition shadow-sm cursor-pointer flex items-center gap-1.5"
          >
            <Save className="w-3.5 h-3.5" />
            <span>Save Timestamp Edits</span>
          </button>
        </div>
      </div>

      {/* Lines Table / List */}
      <div className="space-y-3">
        {lines.map((line, index) => (
          <div
            key={line.id}
            className="p-3.5 sm:p-4 rounded-xl bg-zinc-900/30 border border-zinc-800/80 hover:border-zinc-700/80 transition space-y-3"
          >
            {/* Top row: Line ID + Time nudges */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 border-b border-zinc-800/80 pb-3">
              <div className="flex flex-wrap items-center gap-2 font-mono text-xs">
                <span className="w-6 h-6 rounded bg-zinc-800 text-zinc-300 text-xs flex items-center justify-center font-bold shrink-0">
                  {line.id}
                </span>

                {/* Start Time Nudge */}
                <div className="flex items-center gap-1 bg-zinc-950 px-2 py-1 rounded-md border border-zinc-800">
                  <span className="text-zinc-500 text-[10px] sm:text-[11px]">Start:</span>
                  <span className="font-semibold text-zinc-100 tabular-nums text-xs">{line.startTime}</span>
                  <div className="flex items-center gap-0.5 ml-1">
                    <button
                      onClick={() => nudgeStart(index, -0.5)}
                      className="px-1.5 py-0.5 text-[10px] bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded border border-zinc-700/60 cursor-pointer min-w-[24px] text-center"
                      title="-0.5s"
                    >
                      -0.5
                    </button>
                    <button
                      onClick={() => nudgeStart(index, -0.1)}
                      className="px-1.5 py-0.5 text-[10px] bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded border border-zinc-700/60 cursor-pointer min-w-[24px] text-center"
                      title="-0.1s"
                    >
                      -0.1
                    </button>
                    <button
                      onClick={() => nudgeStart(index, 0.1)}
                      className="px-1.5 py-0.5 text-[10px] bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded border border-zinc-700/60 cursor-pointer min-w-[24px] text-center"
                      title="+0.1s"
                    >
                      +0.1
                    </button>
                    <button
                      onClick={() => nudgeStart(index, 0.5)}
                      className="px-1.5 py-0.5 text-[10px] bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded border border-zinc-700/60 cursor-pointer min-w-[24px] text-center"
                      title="+0.5s"
                    >
                      +0.5
                    </button>
                  </div>
                </div>

                {/* End Time Nudge */}
                <div className="flex items-center gap-1 bg-zinc-950 px-2 py-1 rounded-md border border-zinc-800">
                  <span className="text-zinc-500 text-[10px] sm:text-[11px]">End:</span>
                  <span className="font-semibold text-zinc-100 tabular-nums text-xs">{line.endTime}</span>
                  <div className="flex items-center gap-0.5 ml-1">
                    <button
                      onClick={() => nudgeEnd(index, -0.1)}
                      className="px-1.5 py-0.5 text-[10px] bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded border border-zinc-700/60 cursor-pointer min-w-[24px] text-center"
                      title="-0.1s"
                    >
                      -0.1
                    </button>
                    <button
                      onClick={() => nudgeEnd(index, 0.1)}
                      className="px-1.5 py-0.5 text-[10px] bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded border border-zinc-700/60 cursor-pointer min-w-[24px] text-center"
                      title="+0.1s"
                    >
                      +0.1
                    </button>
                  </div>
                </div>
              </div>

              {/* Action buttons */}
              <div className="flex flex-wrap items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => jumpToLine(line)}
                  className="px-2.5 py-1.5 rounded-md text-xs font-medium bg-zinc-800 hover:bg-zinc-700 text-zinc-200 transition cursor-pointer"
                >
                  Preview
                </button>
                <button
                  type="button"
                  onClick={() => toggleInstrumental(index)}
                  className={`px-2.5 py-1.5 rounded-md text-xs font-medium transition cursor-pointer border ${
                    line.isInstrumental
                      ? 'bg-amber-500/10 text-amber-300 border-amber-500/30'
                      : 'bg-zinc-800/80 text-zinc-400 hover:text-zinc-200 border-zinc-700/60'
                  }`}
                >
                  {line.isInstrumental ? 'Instrumental' : 'Tag Inst'}
                </button>
                <button
                  type="button"
                  onClick={() => addLineAfter(index)}
                  className="p-1.5 rounded-md bg-zinc-800 hover:bg-zinc-700 text-zinc-300 border border-zinc-700/60 cursor-pointer"
                  title="Add cue line after this"
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => deleteLine(index)}
                  disabled={lines.length <= 1}
                  className="p-1.5 rounded-md bg-zinc-800 hover:bg-red-950/60 text-zinc-400 hover:text-red-400 border border-zinc-700/60 disabled:opacity-30 cursor-pointer"
                  title="Delete line"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Editable Fields */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
              <div>
                <label className="block text-[11px] font-medium text-zinc-400 mb-1">
                  Telugu Script (Native)
                </label>
                <input
                  type="text"
                  value={line.telugu}
                  onChange={(e) => updateField(index, 'telugu', e.target.value)}
                  placeholder="సాహిత్యం..."
                  className="w-full bg-zinc-950 border border-zinc-800 focus:border-zinc-500 rounded-lg px-3 py-2 text-sm text-zinc-100 font-['Noto_Sans_Telugu'] outline-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-medium text-zinc-400 mb-1">
                  Romanized Transliteration
                </label>
                <input
                  type="text"
                  value={line.romanized}
                  onChange={(e) => updateField(index, 'romanized', e.target.value)}
                  placeholder="Romanized text..."
                  className="w-full bg-zinc-950 border border-zinc-800 focus:border-zinc-500 rounded-lg px-3 py-2 text-xs sm:text-sm text-zinc-200 outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-medium text-zinc-400 mb-1">
                English Meaning / Translation
              </label>
              <input
                type="text"
                value={line.englishMeaning || ''}
                onChange={(e) => updateField(index, 'englishMeaning', e.target.value)}
                placeholder="English contextual meaning..."
                className="w-full bg-zinc-950 border border-zinc-800 focus:border-zinc-500 rounded-lg px-3 py-1.5 text-xs text-zinc-300 outline-none"
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
