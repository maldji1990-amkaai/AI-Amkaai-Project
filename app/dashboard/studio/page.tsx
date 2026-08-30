"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Film, Image as ImageIcon, Mic2, UserRound, FolderKanban, Sparkles, Plus,
  Play, Wand2, LayoutTemplate, Library, Settings2, Loader2, Save,
  ChevronRight, Trash2, Clapperboard, Users, AudioLines, Boxes, Layers3,
  CheckCircle2, Clock3, AlertCircle, PanelLeft, X, RefreshCw
} from "lucide-react";

type Scene = {
  id: string; index: number; title: string; prompt: string; duration: number;
  status: string; videoUrl?: string | null; imageUrl?: string | null;
  characterId?: string | null; voiceProfileId?: string | null;
};
type Project = { id: string; name: string; description?: string | null; scenes: Scene[]; assets: any[] };
type Character = { id: string; name: string; description?: string | null; imageUrl?: string | null; style?: string | null };
type Voice = { id: string; name: string; description?: string | null; language?: string | null; audioUrl?: string | null };

type Panel = "director" | "scenes" | "characters" | "voices" | "assets" | "templates";

const templates = [
  { name: "Cinematic Ad", type: "VIDEO", prompt: "Create a premium cinematic advertisement with a strong opening shot, elegant product close-ups, dynamic camera movement and a memorable final hero frame." },
  { name: "Social Story", type: "VIDEO", prompt: "Create a fast-paced vertical social video with a hook in the first 2 seconds, three visual beats, subtitles and a clear final call to action." },
  { name: "Product Launch", type: "VIDEO", prompt: "Create a futuristic product launch film with macro details, studio lighting, dramatic transitions and a clean premium visual identity." },
];

export default function StudioPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [project, setProject] = useState<Project | null>(null);
  const [panel, setPanel] = useState<Panel>("director");
  const [prompt, setPrompt] = useState("");
  const [sceneCount, setSceneCount] = useState(6);
  const [selectedSceneId, setSelectedSceneId] = useState<string | null>(null);
  const [characters, setCharacters] = useState<Character[]>([]);
  const [voices, setVoices] = useState<Voice[]>([]);
  const [selectedCharacters, setSelectedCharacters] = useState<string[]>([]);
  const [selectedVoice, setSelectedVoice] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const [rendering, setRendering] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [mobileNav, setMobileNav] = useState(false);
  const [costPreview, setCostPreview] = useState<{ totalSeconds: number; totalCredits: number } | null>(null);
  const [generationId, setGenerationId] = useState<string | null>(null);
  const [finalVideoUrl, setFinalVideoUrl] = useState<string | null>(null);

  const selectedScene = useMemo(() => project?.scenes.find(s => s.id === selectedSceneId) || project?.scenes[0] || null, [project, selectedSceneId]);
  const previewUrl = useMemo(() => finalVideoUrl || project?.scenes.find(s => s.videoUrl)?.videoUrl || null, [finalVideoUrl, project]);

  const loadProjects = useCallback(async () => {
    const res = await fetch("/api/projects", { cache: "no-store" });
    if (!res.ok) return;
    const data = await res.json();
    setProjects(data.projects || []);
    if (!project && data.projects?.[0]) await openProject(data.projects[0].id);
  }, [project]);

  async function openProject(id: string) {
    const res = await fetch(`/api/projects/${id}`, { cache: "no-store" });
    if (!res.ok) return;
    const data = await res.json();
    setProject(data.project);
    setSelectedSceneId(data.project?.scenes?.[0]?.id || null);
    const cost = await fetch(`/api/projects/${id}/cost`, { cache: "no-store" }).then(r => r.ok ? r.json() : null).catch(() => null);
    if (cost) setCostPreview({ totalSeconds: cost.totalSeconds, totalCredits: cost.totalCredits });
  }

  const refreshProject = useCallback(async () => {
    if (project?.id) {
      await openProject(project.id);
      const cost = await fetch(`/api/projects/${project.id}/cost`, { cache: "no-store" }).then(r => r.ok ? r.json() : null).catch(() => null);
      if (cost) setCostPreview({ totalSeconds: cost.totalSeconds, totalCredits: cost.totalCredits });
    }
  }, [project?.id]);

  useEffect(() => {
    loadProjects();
    Promise.all([
      fetch("/api/characters", { cache: "no-store" }),
      fetch("/api/voice-profiles", { cache: "no-store" }),
    ]).then(async ([c, v]) => {
      if (c.ok) setCharacters((await c.json()).characters || []);
      if (v.ok) setVoices((await v.json()).voices || []);
    }).catch(() => undefined);
  }, [loadProjects]);

  // Poll real generation state; never simulate progress.
  useEffect(() => {
    if (!project?.id) return;
    const active = project.scenes.some(s => s.status === "PROCESSING" || s.status === "PENDING") || ["RENDERING", "READY_FOR_POST", "COMPOSING"].includes((project as any).status);
    if (!active && !generationId) return;
    const timer = setInterval(async () => {
      await refreshProject();
      if (generationId) {
        const res = await fetch(`/api/generations/${generationId}`, { cache: "no-store" });
        if (res.ok) {
          const data = await res.json();
          if (data.finalVideoUrl) setFinalVideoUrl(data.finalVideoUrl);
          if (data.generation?.status === "COMPLETED") { setMessage("Your film is ready. Voice, lip-sync, music, captions and final render are complete."); clearInterval(timer); }
          else if (data.generation?.status === "FAILED") { setMessage(data.generation.error || "Production failed. Failed scene jobs are refunded automatically."); clearInterval(timer); }
          else if (data.generation?.project?.status === "READY_FOR_POST") { setMessage("All scenes are ready. Configure the RunPod Composer to continue automatically into voice, lip-sync, music, captions and final render."); clearInterval(timer); }
        }
      }
    }, 5000);
    return () => clearInterval(timer);
  }, [project, refreshProject, generationId]);

  async function createProject(name = "Untitled Production") {
    setBusy(true); setMessage("");
    try {
      const res = await fetch("/api/projects", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not create project");
      await openProject(data.project.id);
      await loadProjects();
    } catch (e: any) { setMessage(e.message); } finally { setBusy(false); }
  }

  async function runDirector() {
    if (prompt.trim().length < 10) return setMessage("Describe the production in at least 10 characters.");
    setBusy(true); setMessage("");
    try {
      const res = await fetch("/api/ai-director", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ prompt, sceneCount }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "AI Director failed");
      await openProject(data.projectId);
      await loadProjects();
      setPrompt("");
      setPanel("scenes");
      setMessage(`${data.scenes?.length || 0} scenes storyboarded successfully.`);
    } catch (e: any) { setMessage(e.message); } finally { setBusy(false); }
  }

  async function updateScene(patch: Partial<Scene>) {
    if (!project || !selectedScene) return;
    const res = await fetch(`/api/projects/${project.id}/scenes/${selectedScene.id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(patch)
    });
    if (!res.ok) { const d = await res.json().catch(() => ({})); setMessage(d.error || "Could not save scene"); return; }
    await refreshProject();
    setMessage("Scene saved.");
  }

  async function addScene() {
    if (!project) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/projects/${project.id}/scenes`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title: `Scene ${(project.scenes?.length || 0) + 1}`, prompt: "Describe the shot...", duration: 5 }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not add scene");
      await refreshProject();
      setSelectedSceneId(data.scene.id);
    } catch (e: any) { setMessage(e.message); } finally { setBusy(false); }
  }

  async function deleteScene(scene: Scene) {
    if (!project || !confirm(`Delete ${scene.title}?`)) return;
    const res = await fetch(`/api/projects/${project.id}/scenes/${scene.id}`, { method: "DELETE" });
    if (res.ok) await refreshProject();
  }

  async function renderScene(scene: Scene) {
    if (!project) return;
    setRendering(scene.id); setMessage("");
    try {
      const res = await fetch("/api/generate-video", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Idempotency-Key": `scene_${scene.id}_${scene.duration}` },
        body: JSON.stringify({ prompt: scene.prompt, duration: scene.duration, projectId: project.id, sceneId: scene.id, characterIds: scene.characterId ? [scene.characterId] : selectedCharacters, voiceProfileId: scene.voiceProfileId || selectedVoice || null })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Render could not be started");
      await updateScene({ status: "PROCESSING" });
      setMessage(`Scene queued. Job ${data.jobId} is processing.`);
    } catch (e: any) { setMessage(e.message); } finally { setRendering(null); }
  }

  async function renderAll() {
    if (!project) return;
    setBusy(true); setMessage("Preparing the full production pipeline...");
    try {
      const res = await fetch(`/api/projects/${project.id}/render`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ characterIds: selectedCharacters, voiceProfileId: selectedVoice || null }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not start project render");
      setGenerationId(data.generationId || null);
      setMessage(`Production queued: ${data.sceneCount || 0} scenes • ${data.totalSeconds || 0}s • ${data.queued?.reduce((n: number, x: any) => n + (x.cost || 0), 0) || 0} credits. Post-production is included.`);
      await refreshProject();
    } catch (e: any) { setMessage(e.message); } finally { setBusy(false); }
  }

  function toggleCharacter(id: string) {
    setSelectedCharacters(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  }

  const nav = [
    ["director", "AI Director", Wand2], ["scenes", "Storyboard", Layers3], ["characters", "Characters", Users],
    ["voices", "Voices", AudioLines], ["assets", "Assets", Boxes], ["templates", "Templates", LayoutTemplate],
  ] as const;

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#020204] text-white">
      <video autoPlay muted loop playsInline className="fixed inset-0 h-full w-full object-cover opacity-20 blur-[1px]" src="/demo/videos/demo.mp4" />
      <div className="fixed inset-0 bg-[radial-gradient(circle_at_50%_15%,rgba(34,211,238,.12),transparent_35%),linear-gradient(180deg,rgba(2,2,4,.72),rgba(2,2,4,.98))]" />

      <div className="relative z-10 flex min-h-screen">
        <aside className="hidden w-64 shrink-0 border-r border-white/10 bg-black/40 p-4 backdrop-blur-2xl lg:flex lg:flex-col">
          <Link href="/" className="mb-7 px-3 text-xl font-black tracking-tight">AMKAAI<span className="text-cyan-400">.</span></Link>
          <button onClick={() => createProject()} disabled={busy} className="mb-5 flex items-center justify-center gap-2 rounded-xl bg-white px-4 py-3 text-sm font-bold text-black disabled:opacity-50"><Plus size={16}/> New project</button>
          <nav className="space-y-1 text-sm">
            {nav.map(([id, label, Icon]) => <button key={id} onClick={() => setPanel(id as Panel)} className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition ${panel === id ? "bg-white/10 text-white" : "text-white/55 hover:bg-white/5 hover:text-white"}`}><Icon size={17}/>{label}</button>)}
          </nav>
          <div className="mt-auto space-y-1 text-sm text-white/55"><Link href="/pricing" className="flex items-center gap-3 rounded-xl px-3 py-2.5 hover:bg-white/5"><Sparkles size={17}/> Credits & Billing</Link><Link href="/dashboard" className="flex items-center gap-3 rounded-xl px-3 py-2.5 hover:bg-white/5"><Settings2 size={17}/> Dashboard</Link></div>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="flex h-16 items-center justify-between border-b border-white/10 bg-black/30 px-4 backdrop-blur-xl md:px-7">
            <div className="flex items-center gap-3"><button onClick={() => setMobileNav(true)} className="lg:hidden"><PanelLeft size={19}/></button><div><div className="text-[10px] uppercase tracking-[.28em] text-white/35">AMKAAI CREATIVE STUDIO</div><div className="text-sm font-semibold">{project?.name || "New production"}</div></div></div>
            <div className="flex items-center gap-2"><button onClick={refreshProject} className="rounded-full border border-white/10 bg-white/5 p-2 text-white/65 hover:text-white" title="Refresh"><RefreshCw size={15}/></button><Link href="/pricing" className="rounded-full border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold">Credits & Billing</Link></div>
          </header>

          {mobileNav && <div className="fixed inset-0 z-50 bg-black/70 lg:hidden" onClick={() => setMobileNav(false)}><aside onClick={e => e.stopPropagation()} className="h-full w-72 bg-[#08080b] p-4 shadow-2xl"><div className="mb-6 flex items-center justify-between"><b>AMKAAI.</b><button onClick={() => setMobileNav(false)}><X size={18}/></button></div>{nav.map(([id, label, Icon]) => <button key={id} onClick={() => { setPanel(id as Panel); setMobileNav(false); }} className={`flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left ${panel === id ? "bg-white/10" : "text-white/60"}`}><Icon size={17}/>{label}</button>)}</aside></div>}

          <div className="grid min-h-0 flex-1 gap-4 p-4 lg:grid-cols-[minmax(0,1fr)_360px] lg:p-6">
            <section className="flex min-w-0 flex-col gap-4">
              <div className="relative min-h-[360px] flex-1 overflow-hidden rounded-3xl border border-white/10 bg-black/45 shadow-2xl backdrop-blur-xl">
                {previewUrl ? <video controls className="absolute inset-0 h-full w-full object-contain" src={previewUrl}/> : <video autoPlay muted loop playsInline className="absolute inset-0 h-full w-full object-cover" src="/demo/videos/demo.mp4"/>}
                <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-transparent to-black/20 pointer-events-none"/>
                <div className="absolute left-5 top-5 flex items-center gap-2 rounded-full border border-white/10 bg-black/45 px-3 py-1.5 text-[10px] uppercase tracking-wider backdrop-blur-xl"><span className="h-1.5 w-1.5 rounded-full bg-emerald-400"/> Live preview</div>
                <div className="absolute bottom-5 left-5 right-5 flex flex-wrap items-end justify-between gap-3"><div><p className="text-xs text-white/45">Production workspace</p><h2 className="text-xl font-semibold">{project?.name || "Create your first production"}</h2></div><div className="flex items-center gap-2 rounded-full border border-white/10 bg-black/45 px-3 py-2 text-[10px] text-white/60 backdrop-blur-xl">{costPreview ? `${costPreview.totalSeconds}s • ${costPreview.totalCredits} credits` : "Cost calculated from duration"}</div><button onClick={renderAll} disabled={!project || busy || !!rendering || !project.scenes.length} className="flex items-center gap-2 rounded-full bg-white px-5 py-3 text-sm font-bold text-black disabled:opacity-40"><Play size={15}/> Render all scenes</button></div>
              </div>

              {finalVideoUrl && <div className="rounded-2xl border border-emerald-400/20 bg-emerald-400/[.06] p-3 text-xs text-emerald-100"><div className="font-semibold">Final film ready</div><div className="mt-1 text-emerald-100/55">Your 5-credits-per-second budget includes the post-production pipeline.</div></div>}

              <div className="rounded-3xl border border-white/10 bg-black/45 p-4 backdrop-blur-xl">
                <div className="mb-3 flex items-center justify-between"><div className="flex items-center gap-2 text-sm font-semibold"><Clapperboard size={16} className="text-cyan-300"/> Storyboard timeline</div><button onClick={addScene} disabled={!project || busy} className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs hover:bg-white/10"><Plus size={13} className="mr-1 inline"/> Scene</button></div>
                <div className="flex gap-2 overflow-x-auto pb-1">
                  {project?.scenes.map(scene => <button key={scene.id} onClick={() => { setSelectedSceneId(scene.id); setPanel("scenes"); }} className={`relative min-w-[150px] overflow-hidden rounded-2xl border p-2 text-left ${selectedScene?.id === scene.id ? "border-cyan-400/60 bg-cyan-400/10" : "border-white/10 bg-white/[.03]"}`}><div className="mb-2 aspect-video overflow-hidden rounded-xl bg-black/60">{scene.videoUrl ? <video muted className="h-full w-full object-cover" src={scene.videoUrl}/> : <div className="flex h-full items-center justify-center text-white/20"><Film size={24}/></div>}</div><div className="flex items-center justify-between gap-2"><span className="truncate text-xs font-semibold">{scene.index + 1}. {scene.title}</span><StatusIcon status={scene.status}/></div><span className="text-[10px] text-white/35">{scene.duration}s</span></button>)}
                  {!project?.scenes.length && <div className="py-6 text-sm text-white/35">Generate a storyboard with AI Director to populate your timeline.</div>}
                </div>
              </div>
            </section>

            <aside className="min-h-0 overflow-hidden rounded-3xl border border-white/10 bg-black/55 backdrop-blur-2xl">
              <div className="flex h-full flex-col">
                <div className="border-b border-white/10 p-4"><div className="mb-3 flex items-center justify-between"><div className="text-sm font-semibold">{nav.find(n => n[0] === panel)?.[1]}</div>{project && <span className="text-[10px] text-white/35">{project.scenes.length} scenes</span>}</div><div className="grid grid-cols-3 gap-1 rounded-xl bg-white/5 p-1">{([["director","Director"],["scenes","Scenes"],["characters","Cast"],["voices","Voices"],["assets","Assets"],["templates","Templates"]] as const).map(([id,label]) => <button key={id} onClick={() => setPanel(id)} className={`rounded-lg px-2 py-1.5 text-[10px] ${panel === id ? "bg-white text-black font-semibold" : "text-white/45"}`}>{label}</button>)}</div></div>

                <div className="min-h-0 flex-1 overflow-y-auto p-4">
                  {panel === "director" && <DirectorPanel prompt={prompt} setPrompt={setPrompt} sceneCount={sceneCount} setSceneCount={setSceneCount} runDirector={runDirector} busy={busy} message={message} templates={templates} onTemplate={(p: string) => setPrompt(p)}/>} 
                  {panel === "scenes" && <ScenePanel scene={selectedScene} project={project} rendering={rendering} characters={characters} voices={voices} onSave={updateScene} onRender={renderScene} onDelete={deleteScene} message={message}/>} 
                  {panel === "characters" && <CharacterPanel characters={characters} selected={selectedCharacters} toggle={toggleCharacter}/>} 
                  {panel === "voices" && <VoicePanel voices={voices} selected={selectedVoice} setSelected={setSelectedVoice}/>} 
                  {panel === "assets" && <AssetPanel projectId={project?.id}/>} 
                  {panel === "templates" && <TemplatePanel templates={templates} onUse={(p: string) => { setPrompt(p); setPanel("director"); }}/>} 
                </div>
              </div>
            </aside>
          </div>
        </div>
      </div>
    </main>
  );
}

function StatusIcon({ status }: { status: string }) { if (status === "COMPLETED") return <CheckCircle2 size={14} className="text-emerald-400"/>; if (status === "FAILED") return <AlertCircle size={14} className="text-red-400"/>; if (status === "PROCESSING" || status === "PENDING") return <Clock3 size={14} className="text-amber-300"/>; return <span className="h-1.5 w-1.5 rounded-full bg-white/30"/>; }

function DirectorPanel({ prompt, setPrompt, sceneCount, setSceneCount, runDirector, busy, message, templates, onTemplate }: any) {
  return <div className="space-y-4"><div className="rounded-2xl border border-cyan-400/15 bg-cyan-400/[.04] p-4"><div className="mb-2 flex items-center gap-2 text-xs font-semibold"><Wand2 size={15} className="text-cyan-300"/> AI Director</div><p className="text-[11px] leading-5 text-white/45">Turn one idea into a production-ready storyboard with continuity notes, camera direction and lighting.</p></div><textarea value={prompt} onChange={e => setPrompt(e.target.value)} placeholder="Example: A cinematic 30-second perfume commercial in Paris at golden hour..." className="min-h-[150px] w-full resize-none rounded-2xl border border-white/10 bg-white/[.03] p-4 text-sm outline-none placeholder:text-white/20 focus:border-cyan-400/40"/><div className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/[.03] p-3"><div><div className="text-xs font-semibold">Scenes</div><div className="text-[10px] text-white/35">Storyboard depth</div></div><select value={sceneCount} onChange={e => setSceneCount(Number(e.target.value))} className="rounded-xl border border-white/10 bg-black px-3 py-2 text-xs"><option value={4}>4</option><option value={6}>6</option><option value={8}>8</option><option value={10}>10</option><option value={12}>12</option></select></div><button onClick={runDirector} disabled={busy} className="w-full rounded-2xl bg-white px-4 py-3 text-sm font-bold text-black disabled:opacity-50">{busy ? <Loader2 size={16} className="mx-auto animate-spin"/> : <><Sparkles size={15} className="mr-2 inline"/> Build storyboard</>}</button>{message && <p className="text-xs text-white/50">{message}</p>}<div><div className="mb-2 text-[10px] uppercase tracking-wider text-white/30">Quick starts</div><div className="space-y-2">{templates.map((t: any) => <button key={t.name} onClick={() => onTemplate(t.prompt)} className="w-full rounded-xl border border-white/10 bg-white/[.03] p-3 text-left hover:bg-white/[.06]"><div className="text-xs font-semibold">{t.name}</div><div className="mt-1 line-clamp-2 text-[10px] text-white/35">{t.prompt}</div></button>)}</div></div></div>;
}

function ScenePanel({ scene, project, rendering, characters, voices, onSave, onRender, onDelete, message }: any) {
  const [title, setTitle] = useState(scene?.title || "");
  const [scenePrompt, setScenePrompt] = useState(scene?.prompt || "");
  const [duration, setDuration] = useState(scene?.duration || 5);
  const [characterId, setCharacterId] = useState(scene?.characterId || "");
  const [voiceProfileId, setVoiceProfileId] = useState(scene?.voiceProfileId || "");
  useEffect(() => {
    setTitle(scene?.title || ""); setScenePrompt(scene?.prompt || ""); setDuration(scene?.duration || 5);
    setCharacterId(scene?.characterId || ""); setVoiceProfileId(scene?.voiceProfileId || "");
  }, [scene?.id]);
  if (!scene || !project) return <Empty text="Create a project and storyboard first."/>;
  return <div className="space-y-4">
    <div className="rounded-2xl border border-white/10 bg-white/[.03] p-3">
      <div className="mb-2 flex items-center justify-between"><span className="text-[10px] uppercase tracking-wider text-white/30">Scene {scene.index + 1}</span><StatusIcon status={scene.status}/></div>
      <input value={title} onChange={e => setTitle(e.target.value)} className="mb-2 w-full bg-transparent text-base font-semibold outline-none"/>
      <textarea value={scenePrompt} onChange={e => setScenePrompt(e.target.value)} className="min-h-[160px] w-full resize-none rounded-xl border border-white/10 bg-black/30 p-3 text-xs leading-5 outline-none focus:border-cyan-400/40"/>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <label className="rounded-xl border border-white/10 bg-black/25 p-2"><span className="mb-1 block text-[9px] uppercase tracking-wider text-white/30">Character</span><select value={characterId} onChange={e => setCharacterId(e.target.value)} className="w-full bg-transparent text-xs outline-none"><option value="">Project default</option>{characters.map((c: Character) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
        <label className="rounded-xl border border-white/10 bg-black/25 p-2"><span className="mb-1 block text-[9px] uppercase tracking-wider text-white/30">Voice</span><select value={voiceProfileId} onChange={e => setVoiceProfileId(e.target.value)} className="w-full bg-transparent text-xs outline-none"><option value="">Project default</option>{voices.map((v: Voice) => <option key={v.id} value={v.id}>{v.name}</option>)}</select></label>
      </div>
      <div className="mt-2 flex items-center gap-2"><label className="text-[10px] text-white/40">Duration</label><input type="number" min={1} max={120} value={duration} onChange={e => setDuration(Number(e.target.value))} className="w-20 rounded-lg border border-white/10 bg-black px-2 py-1.5 text-xs"/><span className="text-[10px] text-white/30">seconds • {duration * 5} credits • {Math.ceil(duration / 5)} clips</span></div>
    </div>
    <div className="rounded-2xl border border-cyan-400/10 bg-cyan-400/[.03] p-3 text-[10px] leading-5 text-white/45"><b className="text-white/70">Continuity</b> — this scene can use its own character and voice. The saved reference is passed to the video worker so the same identity can be preserved without charging extra credits.</div>
    <div className="grid grid-cols-2 gap-2"><button onClick={() => onSave({ title, prompt: scenePrompt, duration, characterId: characterId || null, voiceProfileId: voiceProfileId || null })} className="rounded-xl border border-white/10 bg-white/5 py-2.5 text-xs font-semibold"><Save size={14} className="mr-1 inline"/> Save</button><button onClick={() => onRender({ ...scene, prompt: scenePrompt, duration, characterId: characterId || null, voiceProfileId: voiceProfileId || null })} disabled={rendering === scene.id || !scenePrompt.trim()} className="rounded-xl bg-white py-2.5 text-xs font-bold text-black disabled:opacity-40">{rendering === scene.id ? <Loader2 size={14} className="mx-auto animate-spin"/> : <><Play size={14} className="mr-1 inline"/> Render</>}</button></div>
    <button onClick={() => onDelete(scene)} className="w-full rounded-xl border border-red-400/15 py-2 text-xs text-red-300 hover:bg-red-400/5"><Trash2 size={13} className="mr-1 inline"/> Delete scene</button>{message && <p className="text-xs text-white/40">{message}</p>}
  </div>;
}

function CharacterPanel({ characters, selected, toggle }: any) { return <div className="space-y-2"><p className="mb-3 text-[11px] text-white/40">Select characters to preserve identity across video generations.</p>{characters.length ? characters.map((c: Character) => <button key={c.id} onClick={() => toggle(c.id)} className={`flex w-full items-center gap-3 rounded-2xl border p-3 text-left ${selected.includes(c.id) ? "border-cyan-400/50 bg-cyan-400/10" : "border-white/10 bg-white/[.03]"}`}><div className="h-10 w-10 overflow-hidden rounded-xl bg-white/5">{c.imageUrl ? <img src={c.imageUrl} alt="" className="h-full w-full object-cover"/> : <UserRound className="m-2.5 text-white/30" size={16}/>}</div><div className="min-w-0"><div className="truncate text-xs font-semibold">{c.name}</div><div className="truncate text-[10px] text-white/35">{c.style || c.description || "Character profile"}</div></div></button>) : <Empty text="No saved characters yet."/>}</div>; }
function VoicePanel({ voices, selected, setSelected }: any) { return <div className="space-y-2"><p className="mb-3 text-[11px] text-white/40">Choose a saved voice profile for your production.</p>{voices.length ? voices.map((v: Voice) => <button key={v.id} onClick={() => setSelected(v.id === selected ? "" : v.id)} className={`flex w-full items-center gap-3 rounded-2xl border p-3 text-left ${selected === v.id ? "border-cyan-400/50 bg-cyan-400/10" : "border-white/10 bg-white/[.03]"}`}><div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/5"><AudioLines size={17} className="text-white/45"/></div><div><div className="text-xs font-semibold">{v.name}</div><div className="text-[10px] text-white/35">{v.language || "Voice profile"}</div></div></button>) : <Empty text="No saved voice profiles yet."/>}</div>; }
function AssetPanel({ projectId }: { projectId?: string }) { const [assets, setAssets] = useState<any[]>([]); useEffect(() => { if (!projectId) return; fetch(`/api/assets?projectId=${projectId}`, { cache: "no-store" }).then(r => r.ok ? r.json() : null).then(d => setAssets(d?.assets || [])).catch(() => undefined); }, [projectId]); return <div className="grid grid-cols-2 gap-2">{assets.map(a => <div key={a.id} className="overflow-hidden rounded-xl border border-white/10 bg-white/[.03]"><div className="aspect-square bg-black/40">{a.type === "VIDEO" ? <video muted className="h-full w-full object-cover" src={a.url}/> : <img src={a.url} alt="" className="h-full w-full object-cover"/>}</div><div className="truncate p-2 text-[10px] text-white/55">{a.name}</div></div>)}{!assets.length && <div className="col-span-2"><Empty text="Assets generated for this project will appear here."/></div>}</div>; }
function TemplatePanel({ templates, onUse }: any) { return <div className="space-y-2">{templates.map((t: any) => <div key={t.name} className="rounded-2xl border border-white/10 bg-white/[.03] p-3"><div className="flex items-center justify-between"><div className="text-xs font-semibold">{t.name}</div><button onClick={() => onUse(t.prompt)} className="rounded-lg bg-white px-2.5 py-1.5 text-[10px] font-bold text-black">Use</button></div><p className="mt-2 text-[10px] leading-4 text-white/35">{t.prompt}</p></div>)}</div>; }
function Empty({ text }: { text: string }) { return <div className="rounded-2xl border border-dashed border-white/10 p-6 text-center text-xs text-white/30">{text}</div>; }
