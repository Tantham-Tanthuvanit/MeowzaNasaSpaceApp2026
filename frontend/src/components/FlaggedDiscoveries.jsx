import React, { useState } from 'react';
import { 
  Flag, 
  Sparkles, 
  Download, 
  Trash2, 
  X, 
  Check, 
  FileText, 
  MapPin, 
  Compass, 
  Layers,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  ThumbsUp,
  User,
  Database
} from 'lucide-react';
import { generateDiscoveryDossier } from '../services/astrometry';
import { fetchMpcDossierApi } from '../services/api';

export const CANDIDATE_CATEGORIES = [
  { id: 'planet_x', label: 'Planet X / TNO', color: 'from-purple-500 to-indigo-600', badge: 'bg-purple-500/20 text-purple-300 border-purple-400/50', icon: '🪐' },
  { id: 'brown_dwarf', label: 'Brown Dwarf Candidate', color: 'from-amber-500 to-rose-600', badge: 'bg-amber-500/20 text-amber-300 border-amber-400/50', icon: '⚡' },
  { id: 'variable_star', label: 'Variable Star / Flare', color: 'from-cyan-500 to-blue-600', badge: 'bg-cyan-500/20 text-cyan-300 border-cyan-400/50', icon: '✨' },
  { id: 'asteroid', label: 'Asteroid / Comet', color: 'from-emerald-500 to-teal-600', badge: 'bg-emerald-500/20 text-emerald-300 border-emerald-400/50', icon: '☄️' },
  { id: 'artifact', label: 'Possible Artifact', color: 'from-slate-600 to-slate-700', badge: 'bg-slate-700/40 text-slate-300 border-slate-600', icon: '⚠️' }
];

/**
 * Dialog to configure and confirm a new candidate flag pinned by user clicking on the canvas.
 */
export function FlagCandidateModal({
  pendingFlag,
  onSave,
  onCancel
}) {
  const [category, setCategory] = useState('planet_x');
  const [notes, setNotes] = useState('');
  const [confidence, setConfidence] = useState(4);
  const [observerCallsign, setObserverCallsign] = useState(() => {
    return localStorage.getItem('spherex_observer_callsign') || 'Citizen Scientist';
  });

  if (!pendingFlag) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    const callsign = observerCallsign.trim() || 'Citizen Scientist';
    try {
      localStorage.setItem('spherex_observer_callsign', callsign);
    } catch {}

    onSave({
      id: `SPX-2026-${Date.now().toString().slice(-5)}`,
      category,
      notes: notes.trim(),
      confidence,
      observerCallsign: callsign,
      pixelX: pendingFlag.pixelX,
      pixelY: pendingFlag.pixelY,
      raDeg: pendingFlag.raDeg,
      decDeg: pendingFlag.decDeg,
      raHms: pendingFlag.raHms,
      decDms: pendingFlag.decDms,
      epochLabel: pendingFlag.epochLabel,
      bandGroup: pendingFlag.bandGroup,
      flaggedAt: new Date().toLocaleTimeString()
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fadeIn">
      <div className="bg-slate-900 border border-cyan-500/40 rounded-2xl p-6 max-w-md w-full shadow-2xl relative text-slate-200">
        <button
          onClick={onCancel}
          className="absolute top-4 right-4 text-slate-400 hover:text-white p-1 rounded-lg"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-cyan-500/20 border border-cyan-400/40 flex items-center justify-center text-cyan-300">
            <Flag className="w-5 h-5 text-cyan-400" />
          </div>
          <div>
            <h3 className="font-semibold text-lg text-white">Flag Discovery Candidate</h3>
            <p className="text-xs text-slate-400">Citizen Science Citizen Verification & Reporting</p>
          </div>
        </div>

        {/* Calculated Astrometric Telemetry */}
        <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-3 mb-4 text-xs font-mono space-y-1">
          <div className="flex justify-between">
            <span className="text-slate-400">Calculated RA:</span>
            <span className="text-cyan-300 font-semibold">{pendingFlag.raHms} ({pendingFlag.raDeg.toFixed(4)}°)</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-400">Calculated Dec:</span>
            <span className="text-cyan-300 font-semibold">{pendingFlag.decDms} ({pendingFlag.decDeg.toFixed(4)}°)</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-400">Canvas Pixel (X, Y):</span>
            <span className="text-slate-300">{pendingFlag.pixelX.toFixed(1)}, {pendingFlag.pixelY.toFixed(1)}</span>
          </div>
          <div className="flex justify-between border-t border-slate-800/80 pt-1">
            <span className="text-slate-400">Active View:</span>
            <span className="text-amber-400">{pendingFlag.epochLabel || 'SPHEREx Multi-Epoch'}</span>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          {/* Candidate Category Selection */}
          <div>
            <label className="block text-slate-300 font-medium mb-1.5">Candidate Classification:</label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {CANDIDATE_CATEGORIES.map((cat) => (
                <button
                  type="button"
                  key={cat.id}
                  onClick={() => setCategory(cat.id)}
                  className={`p-2 rounded-lg border text-left flex items-center gap-2 transition-all ${
                    category === cat.id
                      ? 'bg-cyan-500/20 border-cyan-400 text-white font-medium shadow-sm'
                      : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <span className="text-base">{cat.icon}</span>
                  <span className="truncate">{cat.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Confidence Rating */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-slate-300 font-medium">Detection Confidence:</label>
              <span className="text-amber-400 font-mono text-sm">
                {'★'.repeat(confidence)}{'☆'.repeat(5 - confidence)} ({confidence}/5)
              </span>
            </div>
            <input
              type="range"
              min="1"
              max="5"
              step="1"
              value={confidence}
              onChange={(e) => setConfidence(parseInt(e.target.value, 10))}
              className="w-full accent-cyan-400 cursor-pointer"
            />
          </div>

          {/* Observer Callsign / Handle */}
          <div>
            <label className="block text-slate-300 font-medium mb-1">Citizen Scientist Callsign / Identifier:</label>
            <div className="relative">
              <input
                type="text"
                value={observerCallsign}
                onChange={(e) => setObserverCallsign(e.target.value)}
                placeholder="e.g. Astronomer Alex, Backyard Worlds, SpaceApp#104"
                className="w-full px-3 py-1.5 bg-slate-950 border border-slate-700 rounded-lg text-slate-200 focus:outline-none focus:border-cyan-400 pl-8"
              />
              <User className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-2.5" />
            </div>
          </div>

          {/* Observer Notes */}
          <div>
            <label className="block text-slate-300 font-medium mb-1">Observation Notes (Optional):</label>
            <textarea
              rows="2"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Visible dipole in difference mode, no counterpart in Gaia optical overlay..."
              className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-slate-200 focus:outline-none focus:border-cyan-400"
            />
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
            <button
              type="button"
              onClick={onCancel}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-slate-300 font-medium transition-all"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-semibold rounded-lg shadow-md transition-all flex items-center gap-1.5"
            >
              <Check className="w-4 h-4" />
              <span>Confirm & Pin Discovery</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/**
 * Flagged Discoveries Management Panel and Export Engine.
 */
export function FlaggedDiscoveriesPanel({
  candidates = [],
  onDeleteCandidate,
  onClearAll,
  onSelectCandidate,
  onVoteCandidate,
  targetInfo = {}
}) {
  const [isExpanded, setIsExpanded] = useState(true);
  const [votingCandidateId, setVotingCandidateId] = useState(null);
  const [userVotedIds, setUserVotedIds] = useState(() => {
    try {
      const saved = localStorage.getItem('spherex_user_voted_candidates');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  if (candidates.length === 0) return null;

  const handleToggleVote = async (candidateId) => {
    if (votingCandidateId) return; // Anti-spam lock
    setVotingCandidateId(candidateId);

    const hasVoted = userVotedIds.includes(candidateId);
    const voteType = hasVoted ? 'unvote' : 'corroborate';

    try {
      if (onVoteCandidate) {
        await onVoteCandidate(candidateId, { voteType });
      }
      setUserVotedIds((prev) => {
        const next = hasVoted ? prev.filter((id) => id !== candidateId) : [...prev, candidateId];
        try {
          localStorage.setItem('spherex_user_voted_candidates', JSON.stringify(next));
        } catch {}
        return next;
      });
    } catch (err) {
      console.error('Failed to toggle corroboration vote:', err);
    } finally {
      setVotingCandidateId(null);
    }
  };

  const handleDownloadDossier = () => {
    const reportText = generateDiscoveryDossier(candidates, targetInfo);
    const blob = new Blob([reportText], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `SPHEREx_Discovery_Dossier_${Date.now()}.txt`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleDownloadMpc = async () => {
    try {
      const mpcText = await fetchMpcDossierApi();
      if (!mpcText) return;
      const blob = new Blob([mpcText], { type: 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `SPHEREx_MPC_Batch_Dossier_${Date.now()}.txt`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Failed to export MPC dossier:', err);
    }
  };

  const handleDownloadJson = () => {
    const data = {
      mission: 'NASA SPHEREx',
      project: 'Space Apps Challenge 2026 — Planet X and SPHEREx',
      export_timestamp: new Date().toISOString(),
      target_field: targetInfo,
      total_candidates: candidates.length,
      candidates
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `SPHEREx_Candidates_${Date.now()}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="glass-panel p-5 mb-6 border-cyan-500/30">
      {/* Panel Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-cyan-500/20">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-rose-500/20 border border-rose-400/40 flex items-center justify-center text-rose-400">
            <Flag className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-semibold text-white tracking-wide">
                Community Discovery Database
              </h2>
              <span className="bg-rose-500/20 border border-rose-400/40 text-rose-300 font-mono text-xs px-2 py-0.2 rounded-full font-bold">
                {candidates.length} {candidates.length === 1 ? 'Object' : 'Objects'}
              </span>
            </div>
            <p className="text-[11px] text-slate-400">
              Interactive Citizen Science verification log backed by SQLite & ready for Minor Planet Center / NASA submission
            </p>
          </div>
        </div>

        {/* Action Controls: Export Dossier, MPC, JSON, Clear */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={handleDownloadMpc}
            className="px-3 py-1.5 bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 text-white rounded-lg text-xs font-semibold shadow-md transition-all flex items-center gap-1.5"
            title="Download official Minor Planet Center (MPC) batch format directly from database"
          >
            <Database className="w-3.5 h-3.5" />
            <span>Export MPC Format</span>
          </button>

          <button
            onClick={handleDownloadDossier}
            className="px-3 py-1.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-lg text-xs font-semibold shadow-md transition-all flex items-center gap-1.5"
            title="Download formatted NASA / IRSA Verification Dossier"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export NASA Dossier (.txt)</span>
          </button>

          <button
            onClick={handleDownloadJson}
            className="px-2.5 py-1.5 bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-300 hover:text-white rounded-lg text-xs font-mono transition-all flex items-center gap-1"
            title="Export raw candidates as JSON"
          >
            <FileText className="w-3.5 h-3.5 text-cyan-400" />
            <span>JSON</span>
          </button>

          <button
            onClick={onClearAll}
            className="p-1.5 bg-slate-900 hover:bg-rose-950/40 border border-slate-700 hover:border-rose-500/40 text-slate-400 hover:text-rose-300 rounded-lg text-xs transition-all"
            title="Clear all flagged candidates"
          >
            <Trash2 className="w-4 h-4" />
          </button>

          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-1.5 bg-slate-900 border border-slate-700 text-slate-400 hover:text-white rounded-lg"
          >
            {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Candidate List Grid */}
      {isExpanded && (
        <div className="mt-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {candidates.map((c, idx) => {
            const catMeta = CANDIDATE_CATEGORIES.find((cat) => cat.id === c.category) || CANDIDATE_CATEGORIES[0];

            return (
              <div
                key={c.id || idx}
                className="bg-slate-950/80 border border-slate-800 hover:border-cyan-500/40 rounded-xl p-3.5 text-xs transition-all shadow-md relative group flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono border font-semibold flex items-center gap-1 ${catMeta.badge}`}>
                      <span>{catMeta.icon}</span>
                      <span>{catMeta.label}</span>
                    </span>
                    <button
                      onClick={() => onDeleteCandidate(c.id)}
                      className="text-slate-500 hover:text-rose-400 p-1 opacity-80 group-hover:opacity-100 transition-all"
                      title="Remove candidate flag"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <div className="text-[11px] font-mono text-slate-300 space-y-1 mb-2">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400">RA:</span>
                      <span className="text-cyan-300 font-semibold">{c.raHms}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400">Dec:</span>
                      <span className="text-cyan-300 font-semibold">{c.decDms}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400">Pixel:</span>
                      <span className="text-slate-300 font-mono">({c.pixelX?.toFixed(1) ?? '128.0'}, {c.pixelY?.toFixed(1) ?? '128.0'})</span>
                    </div>
                    <div className="flex items-center justify-between text-amber-400">
                      <span className="text-slate-400">Confidence:</span>
                      <span>{'★'.repeat(c.confidence || 4)}{'☆'.repeat(5 - (c.confidence || 4))}</span>
                    </div>
                    {c.observerCallsign && (
                      <div className="flex items-center justify-between text-[10px] text-slate-400 border-t border-slate-800/60 pt-1">
                        <span className="flex items-center gap-1 text-slate-500">
                          <User className="w-3 h-3" />
                          <span>Observer:</span>
                        </span>
                        <span className="text-slate-300 font-sans truncate max-w-[130px]">{c.observerCallsign}</span>
                      </div>
                    )}
                  </div>

                  {c.notes && (
                    <p className="text-[11px] text-slate-400 italic bg-slate-900/60 p-2 rounded border border-slate-800/80 mb-2">
                      "{c.notes}"
                    </p>
                  )}
                </div>

                <div className="mt-2 pt-2 border-t border-slate-800/80 flex items-center justify-between text-[10px] text-slate-500 font-mono">
                  {userVotedIds.includes(c.id) ? (
                    <button
                      onClick={() => handleToggleVote(c.id)}
                      disabled={votingCandidateId === c.id}
                      className="flex items-center gap-1.5 px-2.5 py-1 bg-emerald-950/80 hover:bg-emerald-900 border border-emerald-500/60 hover:border-emerald-400 text-emerald-300 rounded text-[11px] font-semibold transition-all shadow-sm active:scale-95 disabled:opacity-50"
                      title="You corroborated this discovery. Click to remove your vote."
                    >
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Corroborated ({c.upvotes || 1})</span>
                    </button>
                  ) : (
                    <button
                      onClick={() => handleToggleVote(c.id)}
                      disabled={votingCandidateId === c.id}
                      className="flex items-center gap-1.5 px-2.5 py-1 bg-cyan-950/70 hover:bg-cyan-900/80 border border-cyan-500/40 hover:border-cyan-400 text-cyan-300 rounded text-[11px] font-semibold transition-all shadow-sm active:scale-95 disabled:opacity-50"
                      title="Corroborate this citizen science candidate detection"
                    >
                      <ThumbsUp className="w-3.5 h-3.5 text-cyan-400" />
                      <span>Corroborate ({c.upvotes || 1})</span>
                    </button>
                  )}
                  <span className="text-cyan-400/80">{c.id || `Candidate #${idx + 1}`}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
