import React, { useEffect } from 'react';
import { Play, Pause, SkipBack, SkipForward, Repeat, Clock, Film } from 'lucide-react';

export default function TimelineSlider({
  epochs = [],
  currentEpochIndex,
  onEpochChange,
  isPlaying,
  onTogglePlay,
  playbackSpeed, // fps (e.g. 1.0, 2.0, 4.0)
  onSpeedChange
}) {
  const totalEpochs = epochs.length;

  // Auto-advancing playback timer (video-like frame sequence animation)
  useEffect(() => {
    let interval = null;
    if (isPlaying && totalEpochs > 1) {
      const delayMs = 1000 / (playbackSpeed || 1.5);
      interval = setInterval(() => {
        onEpochChange((prev) => (prev + 1) % totalEpochs);
      }, delayMs);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isPlaying, totalEpochs, playbackSpeed, onEpochChange]);

  const handlePrev = () => {
    onEpochChange((prev) => (prev - 1 + totalEpochs) % totalEpochs);
  };

  const handleNext = () => {
    onEpochChange((prev) => (prev + 1) % totalEpochs);
  };

  return (
    <div className="glass-panel p-5 mb-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-3 border-b border-cyan-500/20">
        <div className="flex items-center gap-2">
          <Film className="w-5 h-5 text-cyan-400" />
          <h3 className="text-sm font-semibold tracking-wider uppercase text-cyan-400">
            SPHEREx Mission Time-Lapse Player
          </h3>
          <span className="text-xs text-slate-400 ml-2 mono">
            ({totalEpochs} Survey Epochs &bull; 6-Month Cadence)
          </span>
        </div>

        {/* Playback Speed Controls */}
        <div className="flex items-center gap-2 text-xs">
          <span className="text-slate-400">Blink Cadence:</span>
          {[0.5, 1.0, 2.0, 3.0].map((spd) => (
            <button
              key={spd}
              onClick={() => onSpeedChange(spd)}
              className={`px-2 py-1 rounded mono text-xs font-medium transition-all ${
                playbackSpeed === spd
                  ? 'bg-cyan-500/30 border border-cyan-400 text-cyan-300'
                  : 'bg-slate-900 border border-slate-700 text-slate-400 hover:text-white'
              }`}
            >
              {spd}x
            </button>
          ))}
        </div>
      </div>

      {/* Playback Controls & Scrubber */}
      <div className="mt-4 flex flex-col md:flex-row items-center gap-4">
        {/* Play/Pause & Step Buttons */}
        <div className="flex items-center gap-2">
          <button
            onClick={handlePrev}
            className="p-2 rounded-lg bg-slate-900 border border-slate-700 text-slate-300 hover:text-white hover:border-cyan-400 transition-all"
            title="Previous Frame"
          >
            <SkipBack className="w-4 h-4" />
          </button>

          <button
            onClick={onTogglePlay}
            className={`px-4 py-2 rounded-lg font-semibold text-sm flex items-center gap-2 transition-all shadow-md ${
              isPlaying
                ? 'bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-amber-500/20'
                : 'bg-cyan-500 hover:bg-cyan-400 text-slate-950 shadow-cyan-500/20'
            }`}
          >
            {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
            <span>{isPlaying ? 'Pause Video' : 'Play Time-Lapse'}</span>
          </button>

          <button
            onClick={handleNext}
            className="p-2 rounded-lg bg-slate-900 border border-slate-700 text-slate-300 hover:text-white hover:border-cyan-400 transition-all"
            title="Next Frame"
          >
            <SkipForward className="w-4 h-4" />
          </button>
        </div>

        {/* Timeline Slider Track */}
        <div className="flex-1 w-full flex flex-col gap-2">
          <input
            type="range"
            min={0}
            max={Math.max(0, totalEpochs - 1)}
            step={1}
            value={currentEpochIndex}
            onChange={(e) => onEpochChange(parseInt(e.target.value, 10))}
            className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-cyan-400"
          />

          {/* Epoch Date Labels */}
          <div className="flex justify-between items-center text-xs text-slate-400 mono">
            {epochs.map((ep, idx) => {
              const isActive = idx === currentEpochIndex;
              return (
                <button
                  key={ep.epoch_id || idx}
                  onClick={() => onEpochChange(idx)}
                  className={`flex flex-col items-center transition-all ${
                    isActive ? 'text-cyan-400 font-bold scale-105' : 'hover:text-slate-200'
                  }`}
                >
                  <span className="text-[10px] uppercase tracking-wider">
                    Epoch {idx + 1}
                  </span>
                  <span>{ep.timestamp}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
