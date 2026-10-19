import React, { useState } from 'react';
import {
  BookOpen,
  ExternalLink,
  Plus,
  Trash2,
} from 'lucide-react';
import {
  EvidenceLevel,
  EvidenceLevelEnum,
  MethodologicalCategory,
  MethodologicalCategoryEnum,
  ResearchReference,
} from '../domain/models';
import { useResearchWorkspace } from '../repositories/repository';

export const ResearchLibraryModule: React.FC = () => {
  const {
    snapshot,
    repository,
    refreshWorkspace,
    notifyToast,
    navigateToExperimentInModule,
  } = useResearchWorkspace();

  const [title, setTitle] = useState<string>('');
  const [authors, setAuthors] = useState<string>('');
  const [year, setYear] = useState<number>(2025);
  const [doi, setDoi] = useState<string>('');
  const [venue, setVenue] = useState<string>('');
  const [category, setCategory] = useState<MethodologicalCategory>(
    'Closed-Loop / Checkpoint Recalibration'
  );
  const [evidence, setEvidence] = useState<EvidenceLevel>(
    'Peer-Reviewed Empirical Study'
  );
  const [verification, setVerification] = useState<
    'DOI & Primary Source Verified' | 'Metadata Verified' | 'Unverified Draft'
  >('Metadata Verified');
  const [gapRelevance, setGapRelevance] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [linkedExpId, setLinkedExpId] = useState<string>('');

  if (!snapshot) return null;

  const { researchReferences, experiments } = snapshot;

  const handleAddReference = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !authors.trim() || !venue.trim() || !gapRelevance.trim()) {
      notifyToast('Title, Authors, Venue, and Research Gap Relevance are required.');
      return;
    }

    const ref: ResearchReference = {
      id: `ref-${Date.now()}`,
      title: title.trim(),
      authors: authors.trim(),
      year: Number(year) || 2025,
      DOI: doi.trim(),
      URL: doi.trim() ? `https://doi.org/${doi.trim()}` : '',
      publicationVenue: venue.trim(),
      abstractOrNotes: notes.trim(),
      methodologicalCategory: category,
      evidenceLevel: evidence,
      researchGapRelevance: gapRelevance.trim(),
      relatedExperimentIds: linkedExpId ? [linkedExpId] : [],
      verificationStatus: verification,
      isSampleFixture: false,
      createdAt: new Date().toISOString(),
    };

    await repository.saveResearchReference(ref, true);
    await refreshWorkspace();
    setTitle('');
    setAuthors('');
    setDoi('');
    setGapRelevance('');
    setNotes('');
    notifyToast('Saved literature reference to Research Library.');
  };

  return (
    <div className="space-y-6">
      <div className="bg-[#0F141C] border border-[#1E293B] p-5">
        <div className="text-xs font-mono text-cyan-400">
          MODULE 05 · RESEARCH LIBRARY (LITERATURE & EMPIRICAL GAP TRACEABILITY)
        </div>
        <h1 className="text-xl font-semibold text-[#F1F5F9] mt-0.5">
          Methodological Literature Matrix, Evidence Levels & Experiment Links
        </h1>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Columns: Literature Cards */}
        <div className="lg:col-span-2 space-y-4">
          {researchReferences.length === 0 ? (
            <div className="bg-[#0F141C] border border-[#1E293B] p-6 text-xs text-[#94A3B8]">
              No literature references recorded yet. Add citations using the form on the
              right or load the sample MRAC dataset.
            </div>
          ) : (
            researchReferences.map((ref) => (
              <div
                key={ref.id}
                className="bg-[#0F141C] border border-[#1E293B] p-5 space-y-3"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-1">
                    <div className="text-xs font-mono text-[#94A3B8]">
                      <span>{ref.methodologicalCategory}</span>
                      <span className="mx-1.5">·</span>
                      <span>{ref.evidenceLevel}</span>
                      <span className="mx-1.5">·</span>
                      <span
                        className={
                          ref.verificationStatus === 'DOI & Primary Source Verified'
                            ? 'text-emerald-400'
                            : 'text-amber-400'
                        }
                      >
                        {ref.verificationStatus}
                      </span>
                    </div>
                    <h2 className="text-base font-semibold text-[#F1F5F9]">
                      {ref.title}
                    </h2>
                    <div className="text-xs text-slate-300 font-mono">
                      {ref.authors} ({ref.year}) · {ref.publicationVenue}
                      {ref.DOI && ` · DOI: ${ref.DOI}`}
                    </div>
                  </div>
                  <button
                    onClick={async () => {
                      await repository.deleteResearchReference(ref.id);
                      await refreshWorkspace();
                      notifyToast('Deleted literature reference.');
                    }}
                    className="text-[#94A3B8] hover:text-rose-400 cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="p-3 bg-[#0B0E14] border border-[#1E293B] text-xs space-y-1">
                  <div className="font-mono text-cyan-400 text-[11px]">
                    RESEARCH GAP & THESIS RELEVANCE
                  </div>
                  <p className="text-slate-300 leading-relaxed">
                    {ref.researchGapRelevance}
                  </p>
                </div>

                {ref.abstractOrNotes && (
                  <p className="text-xs text-[#94A3B8] leading-relaxed">
                    {ref.abstractOrNotes}
                  </p>
                )}

                {ref.relatedExperimentIds.length > 0 && (
                  <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-[#1E293B] text-xs font-mono">
                    <span className="text-[#94A3B8]">Linked Experiments:</span>
                    {ref.relatedExperimentIds.map((eid) => {
                      const exp = experiments.find((e) => e.id === eid);
                      return (
                        <button
                          key={eid}
                          onClick={() =>
                            navigateToExperimentInModule(eid, 'experiment-lab')
                          }
                          className="text-cyan-400 hover:underline cursor-pointer"
                        >
                          {exp ? exp.experimentCode : eid}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            ))
          )}
        </div>

        {/* Right Column: Add Reference Form */}
        <form
          onSubmit={handleAddReference}
          className="bg-[#0F141C] border border-[#1E293B] p-5 space-y-3 h-fit"
        >
          <div className="text-xs font-mono text-cyan-400">
            ADD VERIFIED LITERATURE REFERENCE
          </div>
          <div>
            <label className="block text-[11px] font-mono text-[#94A3B8] mb-1">
              Publication Title *
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full bg-[#0B0E14] border border-[#1E293B] px-2.5 py-1.5 text-xs text-[#F1F5F9]"
            />
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div className="col-span-2">
              <label className="block text-[11px] font-mono text-[#94A3B8] mb-1">
                Authors *
              </label>
              <input
                type="text"
                value={authors}
                onChange={(e) => setAuthors(e.target.value)}
                className="w-full bg-[#0B0E14] border border-[#1E293B] px-2.5 py-1.5 text-xs text-[#F1F5F9]"
              />
            </div>
            <div>
              <label className="block text-[11px] font-mono text-[#94A3B8] mb-1">
                Year *
              </label>
              <input
                type="number"
                value={year}
                onChange={(e) => setYear(Number(e.target.value))}
                className="w-full bg-[#0B0E14] border border-[#1E293B] px-2.5 py-1.5 text-xs font-mono text-[#F1F5F9]"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-[11px] font-mono text-[#94A3B8] mb-1">
                Journal / Conference Venue *
              </label>
              <input
                type="text"
                value={venue}
                onChange={(e) => setVenue(e.target.value)}
                className="w-full bg-[#0B0E14] border border-[#1E293B] px-2.5 py-1.5 text-xs text-[#F1F5F9]"
              />
            </div>
            <div>
              <label className="block text-[11px] font-mono text-[#94A3B8] mb-1">
                DOI
              </label>
              <input
                type="text"
                value={doi}
                onChange={(e) => setDoi(e.target.value)}
                placeholder="10.1016/..."
                className="w-full bg-[#0B0E14] border border-[#1E293B] px-2.5 py-1.5 text-xs font-mono text-[#F1F5F9]"
              />
            </div>
          </div>
          <div>
            <label className="block text-[11px] font-mono text-[#94A3B8] mb-1">
              Methodological Category
            </label>
            <select
              value={category}
              onChange={(e) =>
                setCategory(e.target.value as MethodologicalCategory)
              }
              className="w-full bg-[#0B0E14] border border-[#1E293B] px-2.5 py-1.5 text-xs text-[#F1F5F9]"
            >
              {MethodologicalCategoryEnum.options.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-[11px] font-mono text-[#94A3B8] mb-1">
                Evidence Level
              </label>
              <select
                value={evidence}
                onChange={(e) => setEvidence(e.target.value as EvidenceLevel)}
                className="w-full bg-[#0B0E14] border border-[#1E293B] px-2.5 py-1.5 text-xs text-[#F1F5F9]"
              >
                {EvidenceLevelEnum.options.map((ev) => (
                  <option key={ev} value={ev}>
                    {ev}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-mono text-[#94A3B8] mb-1">
                Verification Status
              </label>
              <select
                value={verification}
                onChange={(e) =>
                  setVerification(
                    e.target.value as ResearchReference['verificationStatus']
                  )
                }
                className="w-full bg-[#0B0E14] border border-[#1E293B] px-2.5 py-1.5 text-xs font-mono text-[#F1F5F9]"
              >
                <option value="DOI & Primary Source Verified">
                  DOI & Primary Source Verified
                </option>
                <option value="Metadata Verified">Metadata Verified</option>
                <option value="Unverified Draft">Unverified Draft</option>
              </select>
            </div>
          </div>
          <div>
            <label className="block text-[11px] font-mono text-[#94A3B8] mb-1">
              Research Gap Relevance *
            </label>
            <textarea
              rows={2}
              value={gapRelevance}
              onChange={(e) => setGapRelevance(e.target.value)}
              placeholder="How does this source inform or contrast with your thesis hypothesis?"
              className="w-full bg-[#0B0E14] border border-[#1E293B] px-2.5 py-1.5 text-xs text-[#F1F5F9]"
            />
          </div>
          <div>
            <label className="block text-[11px] font-mono text-[#94A3B8] mb-1">
              Link to Experiment
            </label>
            <select
              value={linkedExpId}
              onChange={(e) => setLinkedExpId(e.target.value)}
              className="w-full bg-[#0B0E14] border border-[#1E293B] px-2.5 py-1.5 text-xs font-mono text-[#F1F5F9]"
            >
              <option value="">None</option>
              {experiments.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.experimentCode} — {e.title}
                </option>
              ))}
            </select>
          </div>
          <button
            type="submit"
            className="w-full py-2 bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-semibold text-xs font-mono cursor-pointer"
          >
            + Save Literature Citation
          </button>
        </form>
      </div>
    </div>
  );
};
