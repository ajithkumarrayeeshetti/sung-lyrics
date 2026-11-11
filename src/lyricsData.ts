export interface WordBreakdown {
  telugu: string;
  romanized: string;
  meaning: string;
}

export interface LyricLine {
  id: number;
  startTime: string; // mm:ss.s
  endTime: string;   // mm:ss.s
  startSeconds: number;
  endSeconds: number;
  telugu: string;
  romanized: string;
  englishMeaning: string;
  isInstrumental?: boolean;
  isUnclear?: boolean;
  notes?: string;
  words?: WordBreakdown[];
}

export interface SongRecord {
  id: string;
  title: string;
  movieOrAlbum?: string;
  composer?: string;
  lyrics?: string;
  singers?: string;
  language: string;
  audioSrc: string;
  durationSeconds: number;
  durationFormatted: string;
  lines: LyricLine[];
  createdAt: number;
  sourceType: 'preset' | 'upload';
  sourceName?: string;
}

export const VEERA_VEERA_LINES: LyricLine[] = [
  {
    id: 1,
    startTime: "00:00.0",
    endTime: "00:03.8",
    startSeconds: 0.0,
    endSeconds: 3.8,
    telugu: "కొర కొర కొరమను భయమితడట అవసరమా",
    romanized: "Kora kora koramanu bhayamithadata avasaramaa",
    englishMeaning: "With blazing fierce stares, is fearing this man even necessary?",
    notes: "Fierce battle opening; 'kora kora' depicts fiery, intense intimidation in the eyes.",
    words: [
      { telugu: "కొర కొర", romanized: "Kora kora", meaning: "Angrily / with piercing glare" },
      { telugu: "కొరమను", romanized: "koramanu", meaning: "fierce stance / blazing anger" },
      { telugu: "భయమితడట", romanized: "bhayamithadata", meaning: "fear of this man" },
      { telugu: "అవసరమా", romanized: "avasaramaa", meaning: "is it needed?" },
    ],
  },
  {
    id: 2,
    startTime: "00:03.8",
    endTime: "00:07.4",
    startSeconds: 3.8,
    endSeconds: 7.4,
    telugu: "మెడ మెడ విరిచేడి కుడి ఎడమల ముసిరొచ్చే శూలం రా",
    romanized: "Meda meda virichedi kudi edamala musirochche shoolam raa",
    englishMeaning: "A neck-snapping trident swooping in from right and left!",
    notes: "Describing violent, swift martial combat swinging like Lord Shiva's trident.",
    words: [
      { telugu: "మెడ మెడ", romanized: "Meda meda", meaning: "Neck after neck" },
      { telugu: "విరిచేడి", romanized: "virichedi", meaning: "that snaps / breaks" },
      { telugu: "కుడి ఎడమల", romanized: "kudi edamala", meaning: "from right and left" },
      { telugu: "ముసిరొచ్చే", romanized: "musirochche", meaning: "swarming / lunging forward" },
      { telugu: "శూలం రా", romanized: "shoolam raa", meaning: "it is a lethal trident!" },
    ],
  },
  {
    id: 3,
    startTime: "00:07.4",
    endTime: "00:11.2",
    startSeconds: 7.4,
    endSeconds: 11.2,
    telugu: "ఒక్కడే వచ్చే ఫిరంగి లెక్క, పొట్టను చీల్చే సింగము లెక్క",
    romanized: "Okkade vachche phirangi lekka, pottanu cheelche singamu lekka",
    englishMeaning: "He marches in solitary like a cannon, tearing bellies apart like a ferocious lion!",
    notes: "Comparison of the hero to an artillery cannon and a man-eating predatory lion.",
    words: [
      { telugu: "ఒక్కడే వచ్చే", romanized: "Okkade vachche", meaning: "He comes alone" },
      { telugu: "ఫిరంగి లెక్క", romanized: "phirangi lekka", meaning: "like a cannon / artillery" },
      { telugu: "పొట్టను చీల్చే", romanized: "pottanu cheelche", meaning: "ripping the belly / gut" },
      { telugu: "సింగము లెక్క", romanized: "singamu lekka", meaning: "like a lion" },
    ],
  },
  {
    id: 4,
    startTime: "00:11.2",
    endTime: "00:15.2",
    startSeconds: 11.2,
    endSeconds: 15.2,
    telugu: "చుట్టుమొత్తము మూడింది లెక్క... హే...",
    romanized: "Chuttu motthamu moodindi lekka... he...",
    englishMeaning: "All around, everyone's doom is counted and sealed... hey!",
    notes: "'మూడింది' (Moodindi) signifies one's end has arrived (the fateful time is up).",
    words: [
      { telugu: "చుట్టుమొత్తము", romanized: "Chuttumotthamu", meaning: "All over the surroundings" },
      { telugu: "మూడింది", romanized: "moodindi", meaning: "doom has struck / time is finished" },
      { telugu: "లెక్క", romanized: "lekka", meaning: "reckoning / count" },
      { telugu: "హే", romanized: "he...", meaning: "war shout" },
    ],
  },
  {
    id: 5,
    startTime: "00:15.2",
    endTime: "00:18.8",
    startSeconds: 15.2,
    endSeconds: 18.8,
    telugu: "ఢీ కొడితే కొండ లెక్క, కొమ్ములుండవు పొట్టేలు లెక్క",
    romanized: "Dhee kodithe konda lekka, kommulundavu pottelu lekka",
    englishMeaning: "If he clashes, it's like an immovable mountain; they will end up hornless like shattered fighting rams!",
    notes: "Depicts adversaries charging at him losing their horns/power completely upon impact.",
    words: [
      { telugu: "ఢీ కొడితే", romanized: "Dhee kodithe", meaning: "If he clashes / collides" },
      { telugu: "కొండ లెక్క", romanized: "konda lekka", meaning: "like a mountain" },
      { telugu: "కొమ్ములుండవు", romanized: "kommulundavu", meaning: "horns will not remain" },
      { telugu: "పొట్టేలు లెక్క", romanized: "pottelu lekka", meaning: "like a defeated ram" },
    ],
  },
  {
    id: 6,
    startTime: "00:18.8",
    endTime: "00:22.4",
    startSeconds: 18.8,
    endSeconds: 22.4,
    telugu: "కాసుకోరా కాసుకోరా హే...",
    romanized: "Kaasukoraa kaasukoraa he...",
    englishMeaning: "Brace yourselves! Defend if you dare! Watch out!",
    notes: "'కాసుకో' is a fiery war cry challenging the opponent to withstand the onslaught.",
    words: [
      { telugu: "కాసుకోరా", romanized: "Kaasukoraa", meaning: "Brace yourself / prepare to face" },
      { telugu: "కాసుకోరా", romanized: "kaasukoraa", meaning: "brace yourself" },
      { telugu: "హే", romanized: "he...", meaning: "exclamation / battle roar" },
    ],
  },
  {
    id: 7,
    startTime: "00:22.4",
    endTime: "00:29.8",
    startSeconds: 22.4,
    endSeconds: 29.8,
    telugu: "వీరా వీరా ఓంకార జ్వాలా నయనం నీదేరా",
    romanized: "Veeraa veeraa omkaara jwaalaa nayanam neederaa",
    englishMeaning: "O Hero! O Brave one! Yours is the Omkara and eyes of blazing fury!",
    notes: "Climactic hook invocation evoking mystical destructive rage (Jwaalaa Nayanam = eyes of fire).",
    words: [
      { telugu: "వీరా వీరా", romanized: "Veeraa veeraa", meaning: "O mighty warrior" },
      { telugu: "ఓంకార", romanized: "omkaara", meaning: "of the primordial Om sound/power" },
      { telugu: "జ్వాలా నయనం", romanized: "jwaalaa nayanam", meaning: "flaming / fiery third eye" },
      { telugu: "నీదేరా", romanized: "neederaa", meaning: "truly belongs to you alone" },
    ],
  },
  {
    id: 8,
    startTime: "00:29.8",
    endTime: "00:36.2",
    startSeconds: 29.8,
    endSeconds: 36.2,
    telugu: "కట్టు మీరిన నీచుల సిగ నరకగ దూకరా అసురా...",
    romanized: "Kattu meerina neechula siga narakaga dookaraa asuraa...",
    englishMeaning: "Pounce like an unstoppable Asura to sever the topknot (decapitate) of vile transgressors!",
    notes: "'సిగ నరకగ' refers to hacking off the head/topknot of wicked enemies.",
    words: [
      { telugu: "కట్టు మీరిన", romanized: "Kattu meerina", meaning: "Transgressing boundaries / crossing the line" },
      { telugu: "నీచుల", romanized: "neechula", meaning: "of vile, corrupt scoundrels" },
      { telugu: "సిగ నరకగ", romanized: "siga narakaga", meaning: "to sever the head / topknot" },
      { telugu: "దూకరా", romanized: "dookaraa", meaning: "leap forth / charge" },
      { telugu: "అసురా", romanized: "asuraa...", meaning: "like an Asura (fierce powerhouse)" },
    ],
  },
  {
    id: 9,
    startTime: "00:36.2",
    endTime: "00:38.6",
    startSeconds: 36.2,
    endSeconds: 38.56,
    telugu: "[INSTRUMENTAL]",
    romanized: "[INSTRUMENTAL]",
    englishMeaning: "Instrumental outro: heavy tribal percussion, rhythmic thumps, and brass crescendo.",
    isInstrumental: true,
    notes: "No vocals sung; powerful closing battle beat and percussive rhythm.",
    words: [],
  },
];

export const DEFAULT_SONG: SongRecord = {
  id: "veera-veera-default",
  title: "Veera Veera (వీరా వీరా)",
  movieOrAlbum: "OM Chapter 1: Udhiram (The Blood Wood)",
  composer: "Sai Abhyankkar",
  lyrics: "Kasarla Shyam",
  singers: "Sai Abhyankkar, Rithesh G. Rao",
  language: "Telugu",
  audioSrc: "/assets/aistudio/KORA_KORA_KORAMANU_...._fyp__explore__viral__selfmotivation_fitnessmotivation_fb31cf82.mp3",
  durationSeconds: 38.56,
  durationFormatted: "00:38.6",
  lines: VEERA_VEERA_LINES,
  createdAt: Date.now(),
  sourceType: 'preset',
  sourceName: 'Sample: Veera Veera Audio',
};

export const SONG_METADATA = DEFAULT_SONG;
export const TRANSCRIPTION_DATA = VEERA_VEERA_LINES;

export function generateMarkdownTable(song: SongRecord): string {
  let md = `### ${song.title}\n`;
  if (song.movieOrAlbum) md += `**Movie/Album:** ${song.movieOrAlbum}  \n`;
  if (song.composer) md += `**Music:** ${song.composer}  \n`;
  if (song.singers) md += `**Singers:** ${song.singers}  \n`;
  md += `**Language:** ${song.language} | **Duration:** ${song.durationFormatted}\n\n`;

  md += `| Line # | Start Time | End Time | Telugu Script | Romanized Telugu | Status / Notes |\n`;
  md += `|:------:|:----------:|:--------:|:--------------|:-----------------|:---------------|\n`;
  song.lines.forEach((line) => {
    const status = line.isInstrumental
      ? `**[INSTRUMENTAL]**`
      : line.isUnclear
      ? `*[UNCLEAR]*`
      : `Sung`;
    md += `| ${line.id} | ${line.startTime} | ${line.endTime} | ${line.telugu} | ${line.romanized} | ${status} |\n`;
  });
  return md;
}

export function generateSRT(song: SongRecord): string {
  const formatSRTTime = (seconds: number) => {
    const h = Math.floor(seconds / 3600).toString().padStart(2, '0');
    const m = Math.floor((seconds % 3600) / 60).toString().padStart(2, '0');
    const s = Math.floor(seconds % 60).toString().padStart(2, '0');
    const ms = Math.floor((seconds % 1) * 1000).toString().padStart(3, '0');
    return `${h}:${m}:${s},${ms}`;
  };

  return song.lines
    .map((line, idx) => {
      return `${idx + 1}\n${formatSRTTime(line.startSeconds)} --> ${formatSRTTime(line.endSeconds)}\n${line.telugu}\n${line.romanized}\n`;
    })
    .join('\n');
}

export function generateLRC(song: SongRecord): string {
  const header = `[ti:${song.title}]\n[ar:${song.singers || ''}]\n[al:${song.movieOrAlbum || ''}]\n\n`;
  const lines = song.lines
    .map((l) => {
      const m = Math.floor(l.startSeconds / 60).toString().padStart(2, '0');
      const s = (l.startSeconds % 60).toFixed(2).padStart(5, '0');
      return `[${m}:${s}] ${l.telugu} (${l.romanized})`;
    })
    .join('\n');
  return header + lines;
}

export function generatePlainText(song: SongRecord): string {
  let text = `${song.title}\n`;
  if (song.movieOrAlbum) text += `Film/Album: ${song.movieOrAlbum}\n`;
  if (song.composer) text += `Music: ${song.composer}\n`;
  if (song.singers) text += `Singers: ${song.singers}\n`;
  text += `Language: ${song.language} | Duration: ${song.durationFormatted}\n\n`;

  song.lines.forEach((l) => {
    text += `[${l.startTime} - ${l.endTime}] ${l.telugu}\n`;
    text += `(${l.romanized})\n`;
    if (l.englishMeaning && !l.isInstrumental) {
      text += `Meaning: ${l.englishMeaning}\n`;
    }
    text += `\n`;
  });
  return text;
}
