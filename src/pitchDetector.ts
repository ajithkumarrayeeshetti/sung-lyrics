/**
 * Real-time Vocal Pitch Detection & Musical Note Mapping
 * Uses normalized autocorrelation algorithm on time-domain PCM samples.
 */

// Musical note names
const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

export interface PitchData {
  pitchHz: number;
  noteName: string;
  octave: number;
  fullNote: string;
  cents: number;
  clarity: number; // confidence between 0 and 1
}

/**
 * Converts frequency in Hz to MIDI note number and musical note string
 */
export function frequencyToNote(freq: number): { noteName: string; octave: number; fullNote: string; cents: number } {
  if (freq <= 0 || isNaN(freq)) {
    return { noteName: '--', octave: 0, fullNote: '--', cents: 0 };
  }
  // MIDI note formula: 69 + 12 * log2(freq / 440)
  const midiNote = 69 + 12 * Math.log2(freq / 440);
  const roundedMidi = Math.round(midiNote);
  const cents = Math.floor((midiNote - roundedMidi) * 100);

  const noteIndex = ((roundedMidi % 12) + 12) % 12;
  const octave = Math.floor(roundedMidi / 12) - 1;
  const noteName = NOTE_NAMES[noteIndex];
  const fullNote = `${noteName}${octave}`;

  return { noteName, octave, fullNote, cents };
}

/**
 * Autocorrelation pitch detection algorithm
 * Optimized for human vocal range (~60 Hz to ~1200 Hz).
 */
export function detectPitch(buffer: Float32Array, sampleRate: number): PitchData | null {
  const SIZE = buffer.length;

  // 1. Compute RMS to filter out silence / noise
  let sumSq = 0;
  for (let i = 0; i < SIZE; i++) {
    sumSq += buffer[i] * buffer[i];
  }
  const rms = Math.sqrt(sumSq / SIZE);
  if (rms < 0.012) {
    // Too quiet to extract reliable vocal pitch
    return null;
  }

  // 2. Bound lag search to human singing vocal range (60 Hz to 1200 Hz)
  const minLag = Math.floor(sampleRate / 1200); // ~1200 Hz max
  const maxLag = Math.floor(sampleRate / 60);   // ~60 Hz min

  if (maxLag >= SIZE) {
    return null;
  }

  let bestLag = -1;
  let maxCorrelation = 0;

  // Pre-calculate energy for normalized cross-correlation
  for (let lag = minLag; lag <= maxLag; lag++) {
    let corr = 0;
    let energy1 = 0;
    let energy2 = 0;

    for (let i = 0; i < SIZE - lag; i++) {
      corr += buffer[i] * buffer[i + lag];
      energy1 += buffer[i] * buffer[i];
      energy2 += buffer[i + lag] * buffer[i + lag];
    }

    const norm = Math.sqrt(energy1 * energy2);
    if (norm > 0) {
      const normalizedCorr = corr / norm;
      if (normalizedCorr > maxCorrelation) {
        maxCorrelation = normalizedCorr;
        bestLag = lag;
      }
    }
  }

  // If correlation is above threshold (confident harmonic pitch)
  if (maxCorrelation > 0.65 && bestLag > 0) {
    // Parabolic interpolation for fine sub-sample frequency resolution
    let refinedLag = bestLag;
    if (bestLag > minLag && bestLag < maxLag) {
      const y1 = calculateCorr(buffer, bestLag - 1);
      const y2 = calculateCorr(buffer, bestLag);
      const y3 = calculateCorr(buffer, bestLag + 1);
      const delta = (y3 - y1) / (2 * (2 * y2 - y1 - y3) || 1);
      if (Math.abs(delta) < 1) {
        refinedLag = bestLag + delta;
      }
    }

    const pitchHz = sampleRate / refinedLag;
    if (pitchHz >= 60 && pitchHz <= 1200) {
      const note = frequencyToNote(pitchHz);
      return {
        pitchHz,
        noteName: note.noteName,
        octave: note.octave,
        fullNote: note.fullNote,
        cents: note.cents,
        clarity: Math.min(1, maxCorrelation),
      };
    }
  }

  return null;
}

function calculateCorr(buffer: Float32Array, lag: number): number {
  let corr = 0;
  for (let i = 0; i < buffer.length - lag; i++) {
    corr += buffer[i] * buffer[i + lag];
  }
  return corr;
}
