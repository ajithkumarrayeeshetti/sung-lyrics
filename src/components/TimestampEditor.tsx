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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-xl bg-slate-900 border border-slate-800">
        <div>
          <h3 className="font-bold text-white text-base flex items-center gap-2">
            <Clock className="w-4 h-4 text-amber-400" />
            <span>Interactive Timestamp & Lyrics Fine-Tuner</span>
          </h3>
          <p className="text-xs text-slate-400">
            Nudge timestamps by ±0.1s or ±0.5s, correct spellings, and save studio-grade synchronized lyrics.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {savedSuccess && (
            <span className="flex items-center gap-1 text-xs text-emerald-400 font-bold bg-emerald-950/80 px-2.5 py-1 rounded-lg border border-emerald-800/80">
              <Check className="w-3.5 h-3.5" /> Saved!
            </span>
          )}
          <button
            type="button"
            onClick={handleSave}
            className="px-4 py-2 rounded-xl text-xs font-bold bg-amber-500 hover:bg-amber-400 text-slate-950 transition shadow cursor-pointer flex items-center gap-1.5"
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
            className="p-4 rounded-xl bg-slate-900/70 border border-slate-800 hover:border-slate-700 transition space-y-3"
          >
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800/80 pb-2.5">
              <div className="flex items-center gap-2 font-mono text-xs">
                <span className="w-6 h-6 rounded-md bg-slate-800 flex items-center justify-center font-bold text-amber-400">
                  {line.id}
                </span>

                {/* Timing controls */}
                <div className="flex items-center gap-1 bg-slate-950 px-2 py-1 rounded-lg border border-slate-800">
                  <span className="text-slate-400">Start:</span>
                  <span className="font-bold text-amber-300">{line.startTime}</span>
                  <button
                    onClick={() => nudgeStart(index, -0.5)}
                    className="px-1 text-[10px] bg-slate-800 hover:bg-slate-700 text-slate-300 rounded"
                    title="-0.5s"
                  >
                    -0.5s
                  </button>
                  <button
                    onClick={() => nudgeStart(index, -0.1)}
                    className="px-1 text-[10px] bg-slate-800 hover:bg-slate-700 text-slate-300 rounded"
                    title="-0.1s"
                  >
                    -0.1s
                  </button>
                  <button
                    onClick={() => nudgeStart(index, 0.1)}
                    className="px-1 text-[10px] bg-slate-800 hover:bg-slate-700 text-slate-300 rounded"
                    title="+0.1s"
                  >
                    +0.1s
                  </button>
                  <button
                    onClick={() => nudgeStart(index, 0.5)}
                    className="px-1 text-[10px] bg-slate-800 hover:bg-slate-700 text-slate-300 rounded"
                    title="+0.5s"
                  >
                    +0.5s
                  </button>
                </div>

                <div className="flex items-center gap-1 bg-slate-950 px-2 py-1 rounded-lg border border-slate-800">
                  <span className="text-slate-400">End:</span>
                  <span className="font-bold text-amber-300">{line.endTime}</span>
                  <button
                    onClick={() => nudgeEnd(index, -0.1)}
                    className="px-1 text-[10px] bg-slate-800 hover:bg-slate-700 text-slate-300 rounded"
                  >
                    -0.1s
                  </button>
                  <button
                    onClick={() => nudgeEnd(index, 0.1)}
                    className="px-1 text-[10px] bg-slate-800 hover:bg-slate-700 text-slate-300 rounded"
                  >
                    +0.1s
                  </button>
                </div>
              </div>

              {/* Action buttons */}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => jumpToLine(line)}
                  className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-amber-500 hover:text-slate-950 text-slate-300 transition cursor-pointer"
                >
                  Preview Audio
                </button>
                <button
                  type="button"
                  onClick={() => toggleInstrumental(index)}
                  className={`px-2 py-1 rounded-lg text-xs font-semibold transition cursor-pointer ${
                    line.isInstrumental
                      ? 'bg-red-950/60 text-red-300 border border-red-800'
                      : 'bg-slate-800 text-slate-400 hover:text-white'
                  }`}
                >
                  {line.isInstrumental ? 'Tag: [INSTRUMENTAL]' : 'Make Instrumental'}
                </button>
                <button
                  type="button"
                  onClick={() => addLineAfter(index)}
                  className="p-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-emerald-400"
                  title="Add line after this"
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => deleteLine(index)}
                  disabled={lines.length <= 1}
                  className="p-1 rounded-lg bg-slate-800 hover:bg-red-950 text-red-400 disabled:opacity-40"
                  title="Delete line"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Editable Fields */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                  Native Script (Telugu)
                </label>
                <input
                  type="text"
                  value={line.telugu || ''}
                  onChange={(e) => updateField(index, 'telugu', e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 focus:border-amber-400 rounded-lg px-3 py-1.5 text-xs text-white outline-none font-['Noto_Sans_Telugu']"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                  Romanized Transliteration
                </label>
                <input
                  type="text"
                  value={line.romanized || ''}
                  onChange={(e) => updateField(index, 'romanized', e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 focus:border-amber-400 rounded-lg px-3 py-1.5 text-xs text-amber-200 outline-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                  English Contextual Meaning
                </label>
                <input
                  type="text"
                  value={line.englishMeaning || ''}
                  onChange={(e) => updateField(index, 'englishMeaning', e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 focus:border-amber-400 rounded-lg px-3 py-1.5 text-xs text-slate-300 outline-none"
                />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
