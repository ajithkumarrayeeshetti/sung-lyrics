import React, { useState } from 'react';
import { FileText, Download, Copy, Check, ArrowRightLeft, Sparkles } from 'lucide-react';

export function SubtitleConverter() {
  const [inputText, setInputText] = useState<string>('');
  const [inputFormat, setInputFormat] = useState<'lrc' | 'srt'>('lrc');
  const [outputFormat, setOutputFormat] = useState<'srt' | 'lrc' | 'txt' | 'markdown'>('srt');
  const [convertedText, setConvertedText] = useState<string>('');
  const [copied, setCopied] = useState(false);

  // LRC Parser to items: { startSec, text }
  const parseLRC = (lrc: string) => {
    const lines = lrc.split('\n');
    const items: Array<{ sec: number; timeFormatted: string; text: string }> = [];

    lines.forEach((line) => {
      const match = line.match(/\[(\d{2}):(\d{2}(?:\.\d{1,3})?)\](.*)/);
      if (match) {
        const mins = parseInt(match[1], 10);
        const secs = parseFloat(match[2]);
        const totalSec = mins * 60 + secs;
        items.push({
          sec: totalSec,
          timeFormatted: `${match[1]}:${match[2]}`,
          text: match[3].trim(),
        });
      }
    });

    return items;
  };

  // SRT Parser to items: { startSec, endSec, text }
  const parseSRT = (srt: string) => {
    const blocks = srt.trim().split(/\n\s*\n/);
    const items: Array<{ sec: number; endSec: number; text: string }> = [];

    blocks.forEach((b) => {
      const lines = b.trim().split('\n');
      if (lines.length >= 2) {
        const timeMatch = lines[1].match(/(\d{2}):(\d{2}):(\d{2}),(\d{3})\s*-->\s*(\d{2}):(\d{2}):(\d{2}),(\d{3})/);
        if (timeMatch) {
          const startSec =
            parseInt(timeMatch[1], 10) * 3600 +
            parseInt(timeMatch[2], 10) * 60 +
            parseInt(timeMatch[3], 10) +
            parseInt(timeMatch[4], 10) / 1000;
          const endSec =
            parseInt(timeMatch[5], 10) * 3600 +
            parseInt(timeMatch[6], 10) * 60 +
            parseInt(timeMatch[7], 10) +
            parseInt(timeMatch[8], 10) / 1000;
          const text = lines.slice(2).join(' ').trim();
          items.push({ sec: startSec, endSec, text });
        }
      }
    });

    return items;
  };

  const handleConvert = () => {
    if (!inputText.trim()) {
      setConvertedText('');
      return;
    }

    let parsedItems: Array<{ sec: number; endSec?: number; text: string }> = [];
    if (inputFormat === 'lrc') {
      const lrcItems = parseLRC(inputText);
      parsedItems = lrcItems.map((item, idx) => ({
        sec: item.sec,
        endSec: lrcItems[idx + 1] ? lrcItems[idx + 1].sec : item.sec + 4.0,
        text: item.text,
      }));
    } else {
      parsedItems = parseSRT(inputText);
    }

    if (parsedItems.length === 0) {
      setConvertedText('Could not parse subtitles. Please check that the input matches the selected format.');
      return;
    }

    // Convert to target format
    let out = '';
    if (outputFormat === 'srt') {
      out = parsedItems
        .map((item, i) => {
          const sSec = item.sec;
          const eSec = item.endSec || sSec + 3.0;

          const toSrtTime = (sec: number) => {
            const h = Math.floor(sec / 3600).toString().padStart(2, '0');
            const m = Math.floor((sec % 3600) / 60).toString().padStart(2, '0');
            const s = Math.floor(sec % 60).toString().padStart(2, '0');
            const ms = Math.floor((sec % 1) * 1000).toString().padStart(3, '0');
            return `${h}:${m}:${s},${ms}`;
          };

          return `${i + 1}\n${toSrtTime(sSec)} --> ${toSrtTime(eSec)}\n${item.text}\n`;
        })
        .join('\n');
    } else if (outputFormat === 'lrc') {
      out = parsedItems
        .map((item) => {
          const m = Math.floor(item.sec / 60).toString().padStart(2, '0');
          const s = (item.sec % 60).toFixed(2).padStart(5, '0');
          return `[${m}:${s}]${item.text}`;
        })
        .join('\n');
    } else if (outputFormat === 'txt') {
      out = parsedItems.map((item) => item.text).join('\n');
    } else if (outputFormat === 'markdown') {
      out = '| # | Start Time | Lyrics |\n|---|------------|--------|\n';
      out += parsedItems
        .map((item, i) => {
          const m = Math.floor(item.sec / 60).toString().padStart(2, '0');
          const s = (item.sec % 60).toFixed(1).padStart(4, '0');
          return `| ${i + 1} | ${m}:${s} | ${item.text} |`;
        })
        .join('\n');
    }

    setConvertedText(out);
  };

  const handleCopy = () => {
    if (!convertedText) return;
    navigator.clipboard.writeText(convertedText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    if (!convertedText) return;
    const blob = new Blob([convertedText], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `subtitles_converted.${outputFormat === 'markdown' ? 'md' : outputFormat}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="rounded-xl bg-zinc-900/50 border border-zinc-800/80 p-5 sm:p-6 space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-zinc-800/80 pb-4">
        <div>
          <h3 className="font-semibold text-zinc-100 text-sm sm:text-base flex items-center gap-2">
            <ArrowRightLeft className="w-4 h-4 text-zinc-400" />
            <span>Subtitle & Lyric Format Converter Lab</span>
          </h3>
          <p className="text-xs text-zinc-400">
            Convert `.lrc`, `.srt`, or plain lyrics files directly in your browser without consuming AI tokens.
          </p>
        </div>

        {/* Format Selectors */}
        <div className="flex items-center gap-2 text-xs">
          <div className="flex items-center gap-1.5 bg-zinc-950 px-2.5 py-1.5 rounded-lg border border-zinc-800">
            <span className="text-zinc-500">From:</span>
            <select
              value={inputFormat}
              onChange={(e) => setInputFormat(e.target.value as any)}
              className="bg-transparent font-medium text-zinc-200 outline-none cursor-pointer"
            >
              <option value="lrc" className="bg-zinc-900 text-zinc-100">LRC (Synced Lyrics)</option>
              <option value="srt" className="bg-zinc-900 text-zinc-100">SRT (Subtitles)</option>
            </select>
          </div>

          <span className="text-zinc-600">→</span>

          <div className="flex items-center gap-1.5 bg-zinc-950 px-2.5 py-1.5 rounded-lg border border-zinc-800">
            <span className="text-zinc-500">To:</span>
            <select
              value={outputFormat}
              onChange={(e) => setOutputFormat(e.target.value as any)}
              className="bg-transparent font-medium text-zinc-200 outline-none cursor-pointer"
            >
              <option value="srt" className="bg-zinc-900 text-zinc-100">.SRT Subtitles</option>
              <option value="lrc" className="bg-zinc-900 text-zinc-100">.LRC Synced Lyrics</option>
              <option value="txt" className="bg-zinc-900 text-zinc-100">.TXT Plain Lyrics</option>
              <option value="markdown" className="bg-zinc-900 text-zinc-100">Markdown Table</option>
            </select>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Input box */}
        <div className="space-y-2">
          <label className="block text-xs font-medium text-zinc-300">
            Input Subtitle Text ({inputFormat.toUpperCase()})
          </label>
          <textarea
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder={
              inputFormat === 'lrc'
                ? '[00:04.20]Veera Veera Ranadheera\n[00:08.50]Gundello Dairyam Choodu'
                : '1\n00:00:04,200 --> 00:00:08,500\nVeera Veera Ranadheera\n\n2\n00:00:08,500 --> 00:00:12,100\nGundello Dairyam Choodu'
            }
            rows={10}
            className="w-full bg-zinc-950 border border-zinc-800 focus:border-zinc-500 focus:ring-1 focus:ring-zinc-500 rounded-lg p-3 text-xs text-zinc-100 font-mono outline-none resize-none"
          />
          <button
            onClick={handleConvert}
            className="w-full py-2.5 rounded-lg text-xs font-semibold bg-zinc-100 hover:bg-white text-zinc-950 transition cursor-pointer flex items-center justify-center gap-1.5 shadow-sm"
          >
            <ArrowRightLeft className="w-3.5 h-3.5" />
            <span>Convert to {outputFormat.toUpperCase()}</span>
          </button>
        </div>

        {/* Output box */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="block text-xs font-medium text-zinc-300">
              Converted Output ({outputFormat.toUpperCase()})
            </label>
            {convertedText && (
              <div className="flex items-center gap-2">
                <button
                  onClick={handleCopy}
                  className="text-xs text-zinc-400 hover:text-white flex items-center gap-1 cursor-pointer transition-colors"
                >
                  {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                  <span>{copied ? 'Copied' : 'Copy'}</span>
                </button>
                <button
                  onClick={handleDownload}
                  className="text-xs text-zinc-400 hover:text-white flex items-center gap-1 cursor-pointer transition-colors"
                >
                  <Download className="w-3 h-3" />
                  <span>Download</span>
                </button>
              </div>
            )}
          </div>
          <textarea
            value={convertedText}
            readOnly
            placeholder="Converted output will appear here..."
            rows={10}
            className="w-full bg-zinc-950/80 border border-zinc-800 rounded-lg p-3 text-xs text-zinc-200 font-mono outline-none resize-none"
          />
        </div>
      </div>
    </div>
  );
}
