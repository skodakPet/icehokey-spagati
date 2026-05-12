import { useState, useEffect, useRef, useCallback } from "react";
import { createClient } from "@supabase/supabase-js";

// ─── SUPABASE CONFIG ─────────────────────────────────────────────────────────
// Tyto hodnoty najdeš v Supabase → Project Settings → API
const SUPABASE_URL = "VLOŽ_SVŮJ_SUPABASE_URL";
const SUPABASE_ANON_KEY = "VLOŽ_SVŮJ_SUPABASE_ANON_KEY";
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ─── BODOVÁNÍ ────────────────────────────────────────────────────────────────
function calcPts(tip, result) {
  if (!tip || !result) return null;
  const [th, ta, rh, ra] = [+tip.home, +tip.away, +result.home, +result.away];
  if ([th, ta, rh, ra].some(isNaN)) return null;
  const td = th - ta, rd = rh - ra;
  const tw = td > 0 ? "h" : "a", rw = rd > 0 ? "h" : "a";
  if (th === rh && ta === ra) return 10;
  if (tw === rw && td === rd) return 6;
  if (tw === rw) return 4;
  if ((th + ta) === (rh + ra) || Math.abs(td) === Math.abs(rd)) return 2;
  return 0;
}
const PL = (p) => {
  if (p === 10) return { t: "Přesný tip!", c: "#FFD60A", e: "🎯" };
  if (p === 6)  return { t: "Vítěz + rozdíl", c: "#34D399", e: "🥈" };
  if (p === 4)  return { t: "Správný vítěz", c: "#60A5FA", e: "✅" };
  if (p === 2)  return { t: "Počet/rozdíl", c: "#FB923C", e: "🟡" };
  return              { t: "Žádné body", c: "#F87171", e: "❌" };
};

// ─── VÝPOČTY ─────────────────────────────────────────────────────────────────
function computeBank(matches, tips, members) {
  let carry = 0;
  const hist = [];
  for (const m of [...matches].sort((a, b) => a.id - b.id)) {
    if (m.status !== "finished" || m.result_home == null) continue;
    const result = { home: String(m.result_home), away: String(m.result_away) };
    const mt = tips.filter(t => t.match_id === m.id);
    const tippers = mt.filter(t => t.home_score !== null && t.away_score !== null);
    const bank = tippers.length + carry;
    const scored = tippers.map(t => ({ name: t.member_name, p: calcPts({ home: String(t.home_score), away: String(t.away_score) }, result) })).filter(x => x.p !== null);
    const max = scored.length ? Math.max(...scored.map(x => x.p)) : 0;
    const winners = scored.filter(x => x.p === max && x.p > 0);
    const winner = winners.length === 1 ? winners[0].name : null;
    carry = winner ? 0 : bank;
    hist.push({ matchId: m.id, bank, scored, winner, carry: winner ? 0 : bank });
  }
  return { hist, carry };
}

function computeStats(matches, tips, members, hist) {
  const s = {};
  members.forEach(m => { s[m.name] = { beers: 0, pts: 0, att: 0, exact: 0 }; });
  for (const m of matches) {
    if (m.status !== "finished" || m.result_home == null) continue;
    const result = { home: String(m.result_home), away: String(m.result_away) };
    const mt = tips.filter(t => t.match_id === m.id);
    for (const t of mt) {
      if (t.home_score == null) continue;
      const p = calcPts({ home: String(t.home_score), away: String(t.away_score) }, result);
      if (p === null || !s[t.member_name]) continue;
      s[t.member_name].att++;
      s[t.member_name].pts += p;
      if (p === 10) s[t.member_name].exact++;
    }
  }
  for (const r of hist) { if (r.winner && s[r.winner]) s[r.winner].beers += r.bank; }
  return s;
}

function computeSettlement(members, hist) {
  const net = {};
  members.forEach(m => { net[m.name] = 0; });
  for (const r of hist) {
    if (!r.winner) continue;
    r.scored.forEach(({ name }) => { if (name !== r.winner) net[name]--; });
    net[r.winner] += r.scored.length - 1;
  }
  const cred = members.filter(m => (net[m.name] || 0) > 0).map(m => ({ n: m.name, v: net[m.name] }));
  const debt = members.filter(m => (net[m.name] || 0) < 0).map(m => ({ n: m.name, v: -net[m.name] }));
  const tx = []; let ci = 0, di = 0;
  while (ci < cred.length && di < debt.length) {
    const g = Math.min(cred[ci].v, debt[di].v);
    tx.push({ from: debt[di].n, to: cred[ci].n, b: g });
    cred[ci].v -= g; debt[di].v -= g;
    if (!cred[ci].v) ci++; if (!debt[di].v) di++;
  }
  return { net, tx };
}

// ─── WA MESSAGE ──────────────────────────────────────────────────────────────
function buildWA(match, tips, members, hist, comment, appName) {
  const rd = hist.find(h => h.matchId === match.id);
  const result = { home: String(match.result_home), away: String(match.result_away) };
  const mt = tips.filter(t => t.match_id === match.id);
  let msg = `🏒 *${appName || "Tipovačka o Plzničku"}*\n`;
  msg += `🇨🇿 Česko *${match.result_home}:${match.result_away}* ${match.opponent}\n`;
  msg += `📅 ${match.match_date} · ${match.phase}\n\n📊 *Výsledky tipů:*\n`;
  mt.filter(t => t.home_score != null)
    .map(t => ({ ...t, p: calcPts({ home: String(t.home_score), away: String(t.away_score) }, result) }))
    .sort((a, b) => b.p - a.p)
    .forEach(t => { const pl = PL(t.p); msg += `${pl.e} *${t.member_name}*: ${t.home_score}:${t.away_score} → ${t.p} bodů\n`; });
  msg += "\n";
  if (rd?.winner) msg += `🏆 *Vítěz kola: ${rd.winner}* bere ${rd.bank} 🍺!\n`;
  else if (rd) msg += `🔄 *Remíza!* ${rd.bank} 🍺 přechází dál\n`;
  if (comment) msg += `\n💬 ${comment}\n`;
  msg += `\n🍺 _${appName || "Tipovačka o Plzničku"}_`;
  return msg;
}

// ─── AVATAR ──────────────────────────────────────────────────────────────────
const COLORS = ["#EF4444","#3B82F6","#10B981","#F59E0B","#8B5CF6","#EC4899","#14B8A6","#F97316"];
function Avatar({ member, size = 36, ring = false }) {
  const col = COLORS[(member?.name || "").charCodeAt(0) % COLORS.length];
  return (
    <div style={{ width: size, height: size, borderRadius: "50%", overflow: "hidden", flexShrink: 0, border: ring ? `2px solid ${col}` : "2px solid transparent" }}>
      {member?.photo_url
        ? <img src={member.photo_url} alt={member.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        : <div style={{ width: "100%", height: "100%", background: `${col}22`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: size * 0.38, fontWeight: 700, color: col }}>
            {(member?.name || "?").slice(0, 1).toUpperCase()}
          </div>
      }
    </div>
  );
}

// ─── CONSTANTS ────────────────────────────────────────────────────────────────
const OPPONENTS = ["Slovensko","Německo","Švýcarsko","Norsko","Švédsko","Finsko","Kanada","USA","Lotyšsko","Dánsko","Rakousko","Maďarsko","Francie","Kazachstán","Velká Británie","Bělorusko","Itálie","Slovinsko"];
const IIHF_LEAGUE = 10;

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN APP
// ═══════════════════════════════════════════════════════════════════════════════
export default function App() {
  // ── State ──
  const [loading, setLoading] = useState(true);
  const [settings, setSettings] = useState(null);
  const [seasons, setSeasons] = useState([]);
  const [activeSeason, setActiveSeason] = useState(null);
  const [members, setMembers] = useState([]);
  const [matches, setMatches] = useState([]);
  const [tips, setTips] = useState([]);
  const [me, setMe] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [adminPwd, setAdminPwd] = useState("");
  const [adminErr, setAdminErr] = useState(false);
  const [showLogin, setShowLogin] = useState(false);
  const [tab, setTab] = useState("zapasy");
  const [notif, setNotif] = useState(null);

  // Modals & forms
  const [showAddMatch, setShowAddMatch] = useState(false);
  const [showAddMember, setShowAddMember] = useState(false);
  const [showAddSeason, setShowAddSeason] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showWA, setShowWA] = useState(null);
  const [showMemberEdit, setShowMemberEdit] = useState(null);
  const [expandedMatch, setExpandedMatch] = useState(null);
  const [editingResult, setEditingResult] = useState(null);
  const [waComment, setWaComment] = useState("");
  const [newMatch, setNewMatch] = useState({ opponent: "", custom: "", date: "", time: "16:20", phase: "Skupina" });
  const [customOpp, setCustomOpp] = useState(false);
  const [newMemberName, setNewMemberName] = useState("");
  const [newSeasonYear, setNewSeasonYear] = useState("");
  const [settingsForm, setSettingsForm] = useState({});
  const [resultInput, setResultInput] = useState({});
  const [liveData, setLiveData] = useState(null);
  const [liveLoading, setLiveLoading] = useState(false);
  const [liveErr, setLiveErr] = useState(null);
  const [manualLive, setManualLive] = useState({ home: "", away: "", status: "" });
  const [showManualLive, setShowManualLive] = useState(false);
  const photoRef = useRef(null);
  const liveInterval = useRef(null);

  // ── Notify ──
  const notify = (msg, type = "ok") => { setNotif({ msg, type }); setTimeout(() => setNotif(null), 3200); };

  // ── Load all data ──
  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [{ data: sett }, { data: seas }] = await Promise.all([
        supabase.from("app_settings").select("*").single(),
        supabase.from("seasons").select("*").order("year", { ascending: false }),
      ]);
      setSettings(sett);
      setSeasons(seas || []);

      const activeId = sett?.active_season_id || seas?.[0]?.id;
      if (activeId) {
        setActiveSeason(seas?.find(s => s.id === activeId) || seas?.[0]);
        await loadSeason(activeId);
      }
    } catch (e) {
      notify("Chyba načítání: " + e.message, "warn");
    }
    setLoading(false);
  }, []);

  const loadSeason = async (seasonId) => {
    const [{ data: mems }, { data: matchList }, { data: tipList }] = await Promise.all([
      supabase.from("members").select("*").eq("season_id", seasonId).order("id"),
      supabase.from("matches").select("*").eq("season_id", seasonId).order("match_date"),
      supabase.from("tips").select("*").in("match_id",
        (await supabase.from("matches").select("id").eq("season_id", seasonId)).data?.map(m => m.id) || []
      ),
    ]);
    setMembers(mems || []);
    setMatches(matchList || []);
    setTips(tipList || []);
    setMe(mems?.[0]?.name || null);
  };

  useEffect(() => { loadAll(); }, [loadAll]);

  // ── Real-time subscriptions ──
  useEffect(() => {
    if (!activeSeason) return;
    const ch = supabase.channel("realtime-tips")
      .on("postgres_changes", { event: "*", schema: "public", table: "tips" }, () => {
        if (activeSeason) loadSeason(activeSeason.id);
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "matches" }, () => {
        if (activeSeason) loadSeason(activeSeason.id);
      })
      .subscribe();
    return () => supabase.removeChannel(ch);
  }, [activeSeason]);

  // ── Live API ──
  const fetchLive = useCallback(async () => {
    if (!settings?.api_key || !nextMatch) return;
    setLiveLoading(true); setLiveErr(null);
    try {
      const today = new Date().toISOString().slice(0, 10);
      const res = await fetch(`https://v1.hockey.api-sports.io/games?league=${IIHF_LEAGUE}&season=${activeSeason?.year || 2026}&date=${today}`, {
        headers: { "x-apisports-key": settings.api_key }
      });
      const data = await res.json();
      if (data.errors && Object.keys(data.errors).length) { setLiveErr("API: " + JSON.stringify(data.errors)); setLiveLoading(false); return; }
      const g = (data.response || []).find(g => {
        const h = (g.teams?.home?.name || "").toLowerCase(), a = (g.teams?.away?.name || "").toLowerCase();
        return h.includes("czech") || a.includes("czech");
      });
      if (g) {
        const czHome = g.teams.home.name.toLowerCase().includes("czech");
        setLiveData({
          homeScore: czHome ? g.scores?.home : g.scores?.away,
          awayScore: czHome ? g.scores?.away : g.scores?.home,
          status: g.status?.long || g.status?.short || "",
          statusShort: g.status?.short || "",
          period: g.periods?.current,
          time: g.status?.timer,
          finished: ["FT","AOT","AP","AET","Finished","After Penalties","After OT"].includes(g.status?.short || ""),
        });
      } else { setLiveData(null); setLiveErr("Dnes žádný zápas Česka."); }
    } catch (e) { setLiveErr("Chyba: " + e.message); }
    setLiveLoading(false);
  }, [settings?.api_key, activeSeason?.year]);

  const nextMatch = matches.find(m => m.status === "upcoming");
  const finishedMatches = matches.filter(m => m.status === "finished");

  useEffect(() => {
    if (!settings?.api_key || !nextMatch) return;
    fetchLive();
    liveInterval.current = setInterval(fetchLive, 60000);
    return () => clearInterval(liveInterval.current);
  }, [fetchLive, settings?.api_key, nextMatch?.id]);

  // ── Computed ──
  const { hist, carry } = computeBank(matches, tips, members);
  const stats = computeStats(matches, tips, members, hist);
  const { net, tx } = computeSettlement(members, hist);
  const ranked = [...members].sort((a, b) => {
    const sa = stats[a.name] || { beers: 0, pts: 0 };
    const sb = stats[b.name] || { beers: 0, pts: 0 };
    return sb.beers !== sa.beers ? sb.beers - sa.beers : sb.pts - sa.pts;
  });

  // ── Admin ──
  const tryAdmin = () => {
    if (adminPwd === settings?.admin_password) { setIsAdmin(true); setShowLogin(false); setAdminPwd(""); setAdminErr(false); notify("🔓 Admin přihlášen"); }
    else setAdminErr(true);
  };

  // ── DB actions ──
  const addMatch = async () => {
    const opp = customOpp ? newMatch.custom.trim() : newMatch.opponent;
    if (!opp || !newMatch.date) { notify("Vyplň soupeře a datum!", "warn"); return; }
    const { error } = await supabase.from("matches").insert({ season_id: activeSeason.id, opponent: opp, match_date: newMatch.date, match_time: newMatch.time, phase: newMatch.phase });
    if (error) { notify("Chyba: " + error.message, "warn"); return; }
    await loadSeason(activeSeason.id);
    setNewMatch({ opponent: "", custom: "", date: "", time: "16:20", phase: "Skupina" }); setShowAddMatch(false); notify("✅ Zápas přidán");
  };

  const deleteMatch = async (id) => {
    await supabase.from("matches").delete().eq("id", id);
    await loadSeason(activeSeason.id); notify("Zápas smazán");
  };

  const setResult = async (matchId) => {
    const ri = resultInput[matchId];
    if (ri?.home === "" || ri?.away === "" || ri?.home == null) { notify("Zadej oba góly!", "warn"); return; }
    const { error } = await supabase.from("matches").update({ status: "finished", result_home: parseInt(ri.home), result_away: parseInt(ri.away) }).eq("id", matchId);
    if (error) { notify("Chyba: " + error.message, "warn"); return; }
    await loadSeason(activeSeason.id); setEditingResult(null); notify("✅ Výsledek uložen");
  };

  const reopenMatch = async (id) => {
    await supabase.from("matches").update({ status: "upcoming", result_home: null, result_away: null }).eq("id", id);
    await loadSeason(activeSeason.id); notify("Zápas znovu otevřen");
  };

  const saveTip = async (matchId, memberName, home, away) => {
    if (home === "" || away === "" || home == null || away == null) return;
    // Check uniqueness (client-side pre-check, DB also enforces)
    const existing = tips.find(t => t.match_id === matchId && t.home_score === parseInt(home) && t.away_score === parseInt(away) && t.member_name !== memberName);
    if (existing) { notify(`⚠ Tip ${home}:${away} už má ${existing.member_name}! Vyber jiný.`, "warn"); return; }
    const { error } = await supabase.from("tips").upsert({ match_id: matchId, member_name: memberName, home_score: parseInt(home), away_score: parseInt(away), updated_at: new Date().toISOString() }, { onConflict: "match_id,member_name" });
    if (error) {
      if (error.code === "23505") notify("⚠ Tento výsledek už někdo tipoval! Vyber jiný.", "warn");
      else notify("Chyba uložení: " + error.message, "warn");
      return;
    }
    // Optimistic update
    setTips(prev => {
      const without = prev.filter(t => !(t.match_id === matchId && t.member_name === memberName));
      return [...without, { match_id: matchId, member_name: memberName, home_score: parseInt(home), away_score: parseInt(away) }];
    });
  };

  const addMember = async () => {
    const name = newMemberName.trim();
    if (!name || members.find(m => m.name === name)) { notify("Jméno prázdné nebo existuje!", "warn"); return; }
    const { error } = await supabase.from("members").insert({ season_id: activeSeason.id, name });
    if (error) { notify("Chyba: " + error.message, "warn"); return; }
    await loadSeason(activeSeason.id); setNewMemberName(""); setShowAddMember(false); notify(`✅ ${name} přidán/a`);
  };

  const removeMember = async (id, name) => {
    await supabase.from("members").delete().eq("id", id);
    await loadSeason(activeSeason.id);
    if (me === name) setMe(members.filter(m => m.name !== name)[0]?.name || null);
    notify(`${name} odebrán/a`);
  };

  const uploadPhoto = async (memberId, memberName, file) => {
    if (!file) return;
    const ext = file.name.split(".").pop();
    const path = `avatars/${memberId}-${Date.now()}.${ext}`;
    const { error: upErr } = await supabase.storage.from("photos").upload(path, file, { upsert: true });
    if (upErr) { notify("Chyba nahrávání: " + upErr.message, "warn"); return; }
    const { data: { publicUrl } } = supabase.storage.from("photos").getPublicUrl(path);
    await supabase.from("members").update({ photo_url: publicUrl }).eq("id", memberId);
    await loadSeason(activeSeason.id); notify("📸 Fotka uložena!");
  };

  const addSeason = async () => {
    const y = parseInt(newSeasonYear);
    if (!y || y < 2000 || y > 2200) { notify("Zadej platný rok!", "warn"); return; }
    if (seasons.find(s => s.year === y)) { notify("Ročník existuje!", "warn"); return; }
    const { data: newSeason, error } = await supabase.from("seasons").insert({ year: y, name: `MS Hokej ${y}` }).select().single();
    if (error) { notify("Chyba: " + error.message, "warn"); return; }
    // Copy members from current season
    if (members.length > 0) {
      await supabase.from("members").insert(members.map(m => ({ season_id: newSeason.id, name: m.name })));
    }
    await supabase.from("app_settings").update({ active_season_id: newSeason.id }).eq("id", 1);
    await loadAll(); setNewSeasonYear(""); setShowAddSeason(false); notify(`✅ Ročník ${y} vytvořen`);
  };

  const switchSeason = async (seasonId) => {
    const s = seasons.find(s => s.id === parseInt(seasonId));
    setActiveSeason(s);
    await supabase.from("app_settings").update({ active_season_id: parseInt(seasonId) }).eq("id", 1);
    await loadSeason(parseInt(seasonId));
    setTab("zapasy");
  };

  const saveSettings = async () => {
    const upd = {};
    if (settingsForm.appName) upd.app_name = settingsForm.appName;
    if (settingsForm.wa) upd.wa_group_name = settingsForm.wa;
    if (settingsForm.pwd) upd.admin_password = settingsForm.pwd;
    if (settingsForm.api !== undefined) upd.api_key = settingsForm.api;
    await supabase.from("app_settings").update(upd).eq("id", 1);
    await loadAll(); setShowSettings(false); notify("✅ Nastavení uloženo");
  };

  const saveResultFromAPI = async (matchId) => {
    if (!liveData || liveData.homeScore == null) return;
    await supabase.from("matches").update({ status: "finished", result_home: liveData.homeScore, result_away: liveData.awayScore }).eq("id", matchId);
    await loadSeason(activeSeason.id); notify("✅ Výsledek z API uložen!");
  };

  const sendWA = (matchId) => {
    const match = matches.find(m => m.id === matchId);
    if (!match?.result_home == null) { notify("Nejdřív zadej výsledek!", "warn"); return; }
    const msg = buildWA(match, tips, members, hist, waComment, settings?.app_name);
    window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, "_blank");
    setShowWA(null);
  };

  // ─── STYLES ──────────────────────────────────────────────────────────────────
  const C = { bg: "#080D16", surface: "#0F172A", border: "#1E293B", text: "#F1F5F9", muted: "#475569", accent: "#3B82F6", gold: "#FFD60A", danger: "#EF4444", green: "#34D399" };
  const card = { background: C.surface, border: `1px solid ${C.border}`, borderRadius: 14, padding: "14px 13px" };
  const inp = { background: "#1E293B", border: "1px solid #334155", borderRadius: 8, padding: "9px 11px", color: C.text, fontSize: 13, fontFamily: "system-ui", width: "100%" };
  const btn = { border: "none", borderRadius: 8, padding: "9px 16px", cursor: "pointer", fontSize: 13, fontFamily: "system-ui", fontWeight: 600, color: C.text, background: "#1E293B" };
  const smBtn = { border: "none", borderRadius: 7, padding: "5px 10px", cursor: "pointer", fontSize: 11, fontFamily: "system-ui", fontWeight: 500, color: C.muted, background: "rgba(255,255,255,0.05)" };
  const scoreInp = { width: 52, background: "#1E293B", border: "1px solid #334155", borderRadius: 8, padding: "8px 4px", color: C.text, fontSize: 20, fontFamily: "system-ui", fontWeight: 700, textAlign: "center" };

  if (loading) return (
    <div style={{ minHeight: "100vh", background: C.bg, display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 16 }}>
      <div style={{ fontSize: 40 }}>🍺</div>
      <div style={{ color: C.accent, fontFamily: "system-ui", fontSize: 16 }}>Načítám tipovačku…</div>
    </div>
  );

  // Config check
  if (SUPABASE_URL === "VLOŽ_SVŮJ_SUPABASE_URL") return (
    <div style={{ minHeight: "100vh", background: C.bg, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <div style={{ ...card, maxWidth: 400, textAlign: "center" }}>
        <div style={{ fontSize: 40, marginBottom: 12 }}>⚠️</div>
        <div style={{ fontSize: 16, fontWeight: 700, color: C.gold, marginBottom: 8 }}>Chybí konfigurace Supabase</div>
        <div style={{ fontSize: 13, color: C.muted, lineHeight: 1.6 }}>
          V souboru <code style={{ color: C.accent }}>App.jsx</code> nahraď:<br/><br/>
          <code style={{ color: "#34D399", fontSize: 11 }}>VLOŽ_SVŮJ_SUPABASE_URL</code><br/>
          <code style={{ color: "#34D399", fontSize: 11 }}>VLOŽ_SVŮJ_SUPABASE_ANON_KEY</code><br/><br/>
          hodnotami z Supabase → Project Settings → API
        </div>
      </div>
    </div>
  );

  // Live score display
  const liveResult = liveData?.homeScore != null ? { home: String(liveData.homeScore), away: String(liveData.awayScore) }
    : manualLive.home !== "" && manualLive.away !== "" ? { home: manualLive.home, away: manualLive.away } : null;

  const liveTipRanking = liveResult && nextMatch
    ? tips.filter(t => t.match_id === nextMatch.id && t.home_score != null)
        .map(t => {
          const m = members.find(mb => mb.name === t.member_name);
          const p = calcPts({ home: String(t.home_score), away: String(t.away_score) }, liveResult);
          return { m, p, t };
        })
        .filter(x => x.m)
        .sort((a, b) => b.p - a.p)
    : [];

  return (
    <div style={{ minHeight: "100vh", background: C.bg, color: C.text, fontFamily: "system-ui,-apple-system,sans-serif", overflowX: "hidden" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&display=swap');
        *{box-sizing:border-box}
        ::-webkit-scrollbar{width:3px}::-webkit-scrollbar-thumb{background:#334155;border-radius:4px}
        @keyframes livePulse{0%,100%{opacity:1;transform:scale(1)}50%{opacity:0.4;transform:scale(0.7)}}
        @keyframes fadeUp{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
        input[type=number]::-webkit-inner-spin-button{opacity:1}
        select option{background:#1E293B;color:#F1F5F9}
        .hov:hover{filter:brightness(1.1)}
      `}</style>

      {/* ══ HEADER ══ */}
      <div style={{ background: "linear-gradient(180deg,#0F172A,#080D16)", borderBottom: `1px solid ${C.border}`, padding: "12px 14px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: 24 }}>🍺</span>
            <div>
              <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 20, letterSpacing: 2, color: C.gold, lineHeight: 1 }}>{settings?.app_name || "Tipovačka o Plzničku"}</div>
              <div style={{ fontSize: 10, color: C.muted, letterSpacing: 2, textTransform: "uppercase", marginTop: 1 }}>MS Hokej {activeSeason?.year} · 🇨🇿</div>
            </div>
          </div>
          <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
            {carry > 0 && <div style={{ background: "#FFD60A18", border: "1px solid #FFD60A44", borderRadius: 20, padding: "3px 10px", fontSize: 12, color: C.gold, fontWeight: 700 }}>🍺 {carry}</div>}
            <select value={activeSeason?.id || ""} onChange={e => switchSeason(e.target.value)} style={{ ...smBtn, background: "#1E293B", color: C.muted, padding: "5px 8px", border: `1px solid ${C.border}`, cursor: "pointer", borderRadius: 7 }}>
              {seasons.map(s => <option key={s.id} value={s.id}>{s.year}</option>)}
            </select>
            {isAdmin
              ? <button onClick={() => { setIsAdmin(false); notify("🔒 Odhlášen"); }} style={{ ...smBtn, color: C.gold, border: `1px solid #FFD60A44` }}>🔓 Admin</button>
              : <button onClick={() => setShowLogin(!showLogin)} style={{ ...smBtn, border: `1px solid ${C.border}` }}>🔐</button>
            }
          </div>
        </div>

        {showLogin && !isAdmin && (
          <div style={{ marginTop: 10, display: "flex", gap: 8, animation: "fadeUp 0.2s ease" }}>
            <input type="password" placeholder="Heslo admina…" value={adminPwd} onChange={e => { setAdminPwd(e.target.value); setAdminErr(false); }} onKeyDown={e => e.key === "Enter" && tryAdmin()} style={{ ...inp, borderColor: adminErr ? C.danger : "#334155" }} />
            <button onClick={tryAdmin} style={{ ...btn, background: C.accent, minWidth: 44 }}>→</button>
          </div>
        )}

        {isAdmin && (
          <div style={{ marginTop: 8, display: "flex", gap: 6, flexWrap: "wrap" }}>
            <button onClick={() => { setSettingsForm({ appName: settings?.app_name, wa: settings?.wa_group_name, api: settings?.api_key || "", pwd: "" }); setShowSettings(true); }} style={{ ...smBtn, color: C.gold, border: `1px solid #FFD60A33` }}>⚙ Nastavení</button>
            <button onClick={() => setShowAddSeason(!showAddSeason)} style={{ ...smBtn, color: "#60A5FA", border: "1px solid #3B82F633" }}>+ Ročník</button>
            <button onClick={() => setShowManualLive(!showManualLive)} style={{ ...smBtn, color: C.green, border: `1px solid #34D39933` }}>📡 Ruční skóre</button>
          </div>
        )}

        {isAdmin && showAddSeason && (
          <div style={{ marginTop: 10, display: "flex", gap: 8, animation: "fadeUp 0.2s ease" }}>
            <input type="number" placeholder="Rok (2027)" value={newSeasonYear} onChange={e => setNewSeasonYear(e.target.value)} onKeyDown={e => e.key === "Enter" && addSeason()} style={{ ...inp, flex: 1 }} />
            <button onClick={addSeason} style={{ ...btn, background: "#1D4ED8", color: "#fff" }}>Vytvořit</button>
            <button onClick={() => setShowAddSeason(false)} style={smBtn}>✕</button>
          </div>
        )}

        {isAdmin && showManualLive && (
          <div style={{ marginTop: 10, background: "#1E293B", borderRadius: 10, padding: "10px 12px", border: `1px solid ${C.border}`, animation: "fadeUp 0.2s ease" }}>
            <div style={{ fontSize: 10, color: C.muted, marginBottom: 8, textTransform: "uppercase", letterSpacing: 1 }}>Ruční live skóre</div>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <input type="number" min="0" placeholder="CZE" value={manualLive.home} onChange={e => setManualLive(v => ({ ...v, home: e.target.value }))} style={{ ...scoreInp, width: 54 }} />
              <span style={{ color: C.muted, fontWeight: 700, fontSize: 20 }}>:</span>
              <input type="number" min="0" placeholder="OPP" value={manualLive.away} onChange={e => setManualLive(v => ({ ...v, away: e.target.value }))} style={{ ...scoreInp, width: 54 }} />
              <input placeholder="Stav (2. třetina…)" value={manualLive.status} onChange={e => setManualLive(v => ({ ...v, status: e.target.value }))} style={{ ...inp, flex: 1, fontSize: 11 }} />
              <button onClick={() => setManualLive({ home: "", away: "", status: "" })} style={{ ...smBtn, color: C.danger }}>✕</button>
            </div>
          </div>
        )}
      </div>

      {/* ══ USER BAR ══ */}
      <div style={{ background: "#0B1120", borderBottom: `1px solid ${C.border}`, padding: "8px 12px", display: "flex", alignItems: "center", gap: 6, overflowX: "auto" }}>
        <span style={{ fontSize: 10, color: "#334155", whiteSpace: "nowrap", textTransform: "uppercase", letterSpacing: 1.5 }}>Já:</span>
        {members.map(m => (
          <button key={m.name} onClick={() => setMe(m.name)} className="hov" style={{ display: "flex", alignItems: "center", gap: 5, background: me === m.name ? "#1E3A5F" : "rgba(255,255,255,0.03)", border: `1px solid ${me === m.name ? C.accent : C.border}`, borderRadius: 20, padding: "3px 10px 3px 4px", cursor: "pointer", flexShrink: 0 }}>
            <Avatar member={m} size={24} ring={me === m.name} />
            <span style={{ fontSize: 11, color: me === m.name ? "#93C5FD" : C.muted, fontWeight: me === m.name ? 700 : 400 }}>{m.name}</span>
          </button>
        ))}
        {isAdmin && <button onClick={() => setShowAddMember(!showAddMember)} style={{ ...smBtn, border: `1px dashed ${C.border}`, flexShrink: 0 }}>+ člen</button>}
      </div>

      {/* Add/manage members */}
      {isAdmin && showAddMember && (
        <div style={{ background: "#0B1120", borderBottom: `1px solid ${C.border}`, padding: "10px 12px", animation: "fadeUp 0.2s ease" }}>
          <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
            <input value={newMemberName} onChange={e => setNewMemberName(e.target.value)} onKeyDown={e => e.key === "Enter" && addMember()} placeholder="Jméno…" style={{ ...inp, flex: 1 }} />
            <button onClick={addMember} style={{ ...btn, background: "#166534", color: C.green }}>Přidat</button>
          </div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {members.map(m => (
              <div key={m.id} style={{ display: "flex", alignItems: "center", gap: 5, background: "#1E293B", border: `1px solid ${C.border}`, borderRadius: 10, padding: "4px 8px" }}>
                <Avatar member={m} size={22} />
                <span style={{ fontSize: 11, color: C.muted }}>{m.name}</span>
                <button onClick={() => setShowMemberEdit(m)} style={{ background: "none", border: "none", color: C.gold, cursor: "pointer", fontSize: 12 }}>📸</button>
                <button onClick={() => removeMember(m.id, m.name)} style={{ background: "none", border: "none", color: C.danger, cursor: "pointer", fontSize: 14 }}>×</button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Member photo modal */}
      {showMemberEdit && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.88)", zIndex: 300, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }} onClick={() => setShowMemberEdit(null)}>
          <div style={{ ...card, maxWidth: 280, width: "100%", animation: "fadeUp 0.2s ease" }} onClick={e => e.stopPropagation()}>
            <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 14 }}>Fotka — {showMemberEdit.name}</div>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
              <Avatar member={showMemberEdit} size={80} ring />
              <input ref={photoRef} type="file" accept="image/*" style={{ display: "none" }} onChange={e => uploadPhoto(showMemberEdit.id, showMemberEdit.name, e.target.files[0])} />
              <button onClick={() => photoRef.current?.click()} style={{ ...btn, background: "#1E3A5F", color: "#93C5FD", width: "100%" }}>📸 Nahrát fotku</button>
              {showMemberEdit.photo_url && (
                <button onClick={async () => { await supabase.from("members").update({ photo_url: null }).eq("id", showMemberEdit.id); await loadSeason(activeSeason.id); notify("Fotka odstraněna"); }} style={{ ...btn, background: "#3F1010", color: C.danger, width: "100%" }}>🗑 Odebrat</button>
              )}
              <button onClick={() => setShowMemberEdit(null)} style={smBtn}>Zavřít</button>
            </div>
          </div>
        </div>
      )}

      {/* Settings modal */}
      {showSettings && isAdmin && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.9)", zIndex: 300, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }} onClick={() => setShowSettings(false)}>
          <div style={{ ...card, maxWidth: 340, width: "100%", animation: "fadeUp 0.2s ease" }} onClick={e => e.stopPropagation()}>
            <div style={{ fontSize: 16, fontWeight: 700, color: C.gold, marginBottom: 16 }}>⚙ Nastavení</div>
            {[["Název aplikace", "appName", "text"], ["WA skupina", "wa", "text"], ["Nové heslo admina", "pwd", "password"], ["API-Sports klíč", "api", "text"]].map(([label, key, type]) => (
              <div key={key} style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 11, color: C.muted, marginBottom: 4 }}>{label}</div>
                <input type={type} placeholder={key === "api" ? "api-sports.io klíč (zdarma)" : key === "pwd" ? "(ponechat)" : ""} value={settingsForm[key] || ""} onChange={e => setSettingsForm(f => ({ ...f, [key]: e.target.value }))} style={inp} />
              </div>
            ))}
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={saveSettings} style={{ ...btn, background: C.accent, color: "#fff", flex: 1 }}>Uložit</button>
              <button onClick={() => setShowSettings(false)} style={{ ...btn, flex: 1 }}>Zrušit</button>
            </div>
          </div>
        </div>
      )}

      {/* WA modal */}
      {showWA && (() => {
        const match = matches.find(m => m.id === showWA);
        if (!match) return null;
        const msg = buildWA(match, tips, members, hist, waComment, settings?.app_name);
        return (
          <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.9)", zIndex: 300, display: "flex", alignItems: "flex-end", justifyContent: "center" }} onClick={() => setShowWA(null)}>
            <div style={{ background: "#0F172A", borderTop: "1px solid #25D36644", borderRadius: "16px 16px 0 0", padding: "20px 16px 36px", width: "100%", maxWidth: 480, animation: "fadeUp 0.2s ease" }} onClick={e => e.stopPropagation()}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                <div style={{ width: 30, height: 30, background: "#25D366", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center" }}>💬</div>
                <span style={{ fontSize: 15, fontWeight: 700, color: "#25D366" }}>Sdílet na WhatsApp</span>
              </div>
              <div style={{ background: "#0B1120", borderRadius: 10, padding: "10px 12px", marginBottom: 12, fontSize: 11, color: "#94A3B8", whiteSpace: "pre-wrap", maxHeight: 180, overflowY: "auto", lineHeight: 1.6, border: `1px solid ${C.border}` }}>{msg}</div>
              <input value={waComment} onChange={e => setWaComment(e.target.value)} placeholder="Přidat komentář…" style={{ ...inp, marginBottom: 14 }} />
              <div style={{ display: "flex", gap: 8 }}>
                <button onClick={() => sendWA(showWA)} style={{ ...btn, background: "#16A34A", color: "#fff", flex: 2 }}>Otevřít WhatsApp →</button>
                <button onClick={() => setShowWA(null)} style={{ ...btn, flex: 1 }}>Zrušit</button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Notification */}
      {notif && (
        <div style={{ position: "fixed", top: 68, left: "50%", transform: "translateX(-50%)", background: notif.type === "warn" ? "#450A0A" : "#052E16", border: `1px solid ${notif.type === "warn" ? C.danger : C.green}`, padding: "10px 20px", borderRadius: 10, zIndex: 9999, fontSize: 13, animation: "fadeUp 0.2s ease", boxShadow: "0 8px 32px rgba(0,0,0,0.8)", fontWeight: 500, whiteSpace: "nowrap" }}>
          {notif.msg}
        </div>
      )}

      {/* ══ TABS ══ */}
      <div style={{ display: "flex", background: "#080D16", borderBottom: `1px solid ${C.border}` }}>
        {[["zapasy","🏒 Zápasy"],["tabulka","📊 Tabulka"],["banka","🍺 Banka"],["vyrovnani","💸 Vyrovnání"],["archiv","📁 Archiv"]].map(([id, label]) => (
          <button key={id} onClick={() => setTab(id)} style={{ flex: 1, padding: "11px 2px", background: "none", border: "none", borderBottom: `2px solid ${tab === id ? C.accent : "transparent"}`, color: tab === id ? C.accent : C.muted, cursor: "pointer", fontSize: 9.5, fontWeight: tab === id ? 700 : 400 }}>
            {label}
          </button>
        ))}
      </div>

      <div style={{ padding: "12px 12px 100px" }}>

        {/* ══════ ZÁPASY ══════ */}
        {tab === "zapasy" && (
          <>
            {/* Live widget */}
            {nextMatch && (
              <div style={{ background: "linear-gradient(135deg,#0F172A,#1E293B)", border: "1px solid #334155", borderRadius: 16, padding: "16px 14px", marginBottom: 14 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 10 }}>
                  <div style={{ width: 7, height: 7, background: liveData?.finished ? C.green : C.danger, borderRadius: "50%", animation: liveData?.finished ? "none" : "livePulse 1.2s ease-in-out infinite" }} />
                  <span style={{ fontSize: 10, fontWeight: 700, color: liveData?.finished ? C.green : C.danger, letterSpacing: 2, textTransform: "uppercase" }}>
                    {liveData?.finished ? "Konec zápasu" : liveData?.status || (settings?.api_key ? (liveLoading ? "Načítám…" : "Live") : "Nadcházející zápas")}
                  </span>
                  {liveData?.period && !liveData.finished && <span style={{ fontSize: 10, color: C.muted }}>· {liveData.period}. třetina{liveData.time ? ` · ${liveData.time}′` : ""}</span>}
                  {settings?.api_key && <button onClick={fetchLive} style={{ marginLeft: "auto", background: "none", border: "none", color: C.muted, cursor: "pointer", fontSize: 14 }}>⟳</button>}
                </div>

                {liveErr && <div style={{ fontSize: 11, color: C.danger, marginBottom: 8 }}>{liveErr}</div>}

                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: liveResult ? 14 : 8 }}>
                  <div style={{ textAlign: "center", flex: 1 }}>
                    <div style={{ fontSize: 28 }}>🇨🇿</div>
                    <div style={{ fontSize: 12, fontWeight: 700 }}>Česko</div>
                  </div>
                  <div style={{ textAlign: "center" }}>
                    {liveResult
                      ? <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 44, lineHeight: 1, letterSpacing: 2 }}>
                          <span style={{ color: +liveResult.home > +liveResult.away ? C.green : +liveResult.home < +liveResult.away ? C.danger : C.text }}>{liveResult.home}</span>
                          <span style={{ color: C.muted, fontSize: 32, margin: "0 4px" }}>:</span>
                          <span style={{ color: +liveResult.away > +liveResult.home ? C.green : +liveResult.away < +liveResult.home ? C.danger : C.text }}>{liveResult.away}</span>
                        </div>
                      : <div style={{ fontSize: 24, color: C.muted, letterSpacing: 4 }}>– : –</div>
                    }
                    <div style={{ fontSize: 9, color: C.muted, textTransform: "uppercase", letterSpacing: 2 }}>{nextMatch.phase}</div>
                  </div>
                  <div style={{ textAlign: "center", flex: 1 }}>
                    <div style={{ fontSize: 28 }}>🏒</div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: "#94A3B8" }}>{nextMatch.opponent}</div>
                  </div>
                </div>

                {/* Save from API */}
                {isAdmin && liveData?.finished && liveResult && (
                  <button onClick={() => saveResultFromAPI(nextMatch.id)} style={{ width: "100%", marginBottom: 12, background: "linear-gradient(90deg,#166534,#15803D)", border: "none", borderRadius: 10, padding: 11, color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
                    ✅ Uložit výsledek {liveResult.home}:{liveResult.away} z API
                  </button>
                )}

                {/* Tip ranking */}
                {liveTipRanking.length > 0 && (
                  <>
                    <div style={{ fontSize: 10, color: C.muted, textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 8 }}>
                      {liveData?.finished ? "Výsledné pořadí" : "Aktuální pořadí tipů"}
                    </div>
                    {liveTipRanking.map(({ m, p, t }, i) => {
                      const pl = PL(p);
                      return (
                        <div key={m.name} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 5, background: i === 0 ? "#FFD60A11" : "rgba(255,255,255,0.03)", borderRadius: 8, padding: "6px 10px", border: i === 0 ? "1px solid #FFD60A33" : "none" }}>
                          <span style={{ fontSize: 14, width: 20 }}>{["🥇","🥈","🥉"][i] || `${i+1}.`}</span>
                          <Avatar member={m} size={26} />
                          <div style={{ flex: 1, fontSize: 12, fontWeight: i === 0 ? 700 : 400 }}>{m.name}</div>
                          <span style={{ fontSize: 11, color: C.muted }}>tip: <b style={{ color: C.text }}>{t.home_score}:{t.away_score}</b></span>
                          <span style={{ fontSize: 12, fontWeight: 700, color: pl.c }}>{p}b {pl.e}</span>
                        </div>
                      );
                    })}
                  </>
                )}
              </div>
            )}

            {/* Add match */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
              <span style={{ fontSize: 10, color: C.muted, textTransform: "uppercase", letterSpacing: 1 }}>Zápasy {activeSeason?.year}</span>
              {isAdmin && <button onClick={() => setShowAddMatch(!showAddMatch)} className="hov" style={{ ...btn, background: C.danger, color: "#fff", fontSize: 12, padding: "7px 14px" }}>+ Zápas</button>}
            </div>

            {isAdmin && showAddMatch && (
              <div style={{ ...card, marginBottom: 12, animation: "fadeUp 0.2s ease" }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: C.gold, marginBottom: 12 }}>Nový zápas — 🇨🇿 Česko vs:</div>
                {!customOpp
                  ? <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
                      <select value={newMatch.opponent} onChange={e => setNewMatch(f => ({ ...f, opponent: e.target.value }))} style={{ ...inp, flex: 1 }}>
                        <option value="">Vybrat soupeře…</option>
                        {OPPONENTS.map(o => <option key={o} value={o}>{o}</option>)}
                      </select>
                      <button onClick={() => setCustomOpp(true)} style={{ ...smBtn, color: C.gold, border: `1px solid #FFD60A33` }}>Vlastní</button>
                    </div>
                  : <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
                      <input value={newMatch.custom} onChange={e => setNewMatch(f => ({ ...f, custom: e.target.value }))} placeholder="Napsat soupeře…" style={{ ...inp, flex: 1 }} />
                      <button onClick={() => setCustomOpp(false)} style={smBtn}>← Seznam</button>
                    </div>
                }
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 8 }}>
                  <input type="date" value={newMatch.date} onChange={e => setNewMatch(f => ({ ...f, date: e.target.value }))} style={inp} />
                  <input type="time" value={newMatch.time} onChange={e => setNewMatch(f => ({ ...f, time: e.target.value }))} style={inp} />
                </div>
                <div style={{ display: "flex", gap: 5, flexWrap: "wrap", marginBottom: 12 }}>
                  {["Skupina","Čtvrtfinále","Semifinále","Finále","Bronz","Baráž"].map(p => (
                    <button key={p} onClick={() => setNewMatch(f => ({ ...f, phase: p }))} style={{ ...smBtn, background: newMatch.phase === p ? "#1D4ED8" : "rgba(255,255,255,0.04)", color: newMatch.phase === p ? "#93C5FD" : C.muted }}>
                      {p}
                    </button>
                  ))}
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <button onClick={addMatch} style={{ ...btn, background: C.danger, color: "#fff", flex: 1 }}>Uložit</button>
                  <button onClick={() => setShowAddMatch(false)} style={btn}>Zrušit</button>
                </div>
              </div>
            )}

            {/* Upcoming matches */}
            {matches.filter(m => m.status === "upcoming").map(match => {
              const expanded = expandedMatch === match.id;
              const matchTips = tips.filter(t => t.match_id === match.id);
              const tipCount = matchTips.filter(t => t.home_score != null).length;
              const myTip = matchTips.find(t => t.member_name === me);
              const hasMine = myTip?.home_score != null;

              return (
                <div key={match.id} style={{ ...card, marginBottom: 10, border: `1px solid ${expanded ? C.accent + "66" : C.border}` }}>
                  <div onClick={() => setExpandedMatch(expanded ? null : match.id)} style={{ cursor: "pointer" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <div>
                        <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 19, letterSpacing: 1.5 }}>🇨🇿 ČESKO <span style={{ color: C.muted }}>vs</span> {match.opponent.toUpperCase()}</div>
                        <div style={{ fontSize: 10, color: C.muted, marginTop: 2 }}>{match.phase} · {match.match_date}{match.match_time ? ` · ${match.match_time}` : ""}</div>
                      </div>
                      <div style={{ textAlign: "right" }}>
                        <div style={{ fontSize: 12, color: C.gold }}>🍺 {tipCount + carry}</div>
                        <div style={{ fontSize: 9, color: "#334155" }}>{tipCount}/{members.length}</div>
                        <div style={{ color: C.muted, fontSize: 12, marginTop: 2 }}>{expanded ? "▲" : "▼"}</div>
                      </div>
                    </div>
                    {!expanded && <div style={{ marginTop: 5, fontSize: 11, color: hasMine ? C.green : C.danger, fontWeight: hasMine ? 400 : 600 }}>
                      {hasMine ? `Tvůj tip: ${myTip.home_score} : ${myTip.away_score}` : "⚠ Ještě jsi netipoval/a"}
                    </div>}
                  </div>

                  {expanded && (
                    <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: 12, marginTop: 10 }}>
                      <div style={{ fontSize: 10, color: C.muted, textTransform: "uppercase", letterSpacing: 1, marginBottom: 10 }}>Česko : {match.opponent}</div>
                      {members.map(m => {
                        const tip = matchTips.find(t => t.member_name === m.name);
                        const isMe = m.name === me;
                        const [localH, setLocalH] = useState(tip?.home_score != null ? String(tip.home_score) : "");
                        const [localA, setLocalA] = useState(tip?.away_score != null ? String(tip.away_score) : "");
                        return (
                          <div key={m.name} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                            <Avatar member={m} size={28} ring={isMe} />
                            <div style={{ width: 56, fontSize: 11, color: isMe ? C.text : C.muted, fontWeight: isMe ? 700 : 400, flexShrink: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{m.name}</div>
                            <input type="number" min="0" max="30" placeholder="CZE" value={localH} onChange={e => setLocalH(e.target.value)} onBlur={() => saveTip(match.id, m.name, localH, localA)} style={{ ...scoreInp, background: isMe ? "#1E3A5F" : "#1E293B", borderColor: isMe ? C.accent : "#334155" }} />
                            <span style={{ color: C.muted, fontWeight: 700, fontSize: 18 }}>:</span>
                            <input type="number" min="0" max="30" placeholder="OPP" value={localA} onChange={e => setLocalA(e.target.value)} onBlur={() => saveTip(match.id, m.name, localH, localA)} style={{ ...scoreInp, background: isMe ? "#1E3A5F" : "#1E293B", borderColor: isMe ? C.accent : "#334155" }} />
                            {tip?.home_score != null && <span style={{ fontSize: 12, color: C.gold }}>✓</span>}
                          </div>
                        );
                      })}
                      {isAdmin && (
                        <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: 10, marginTop: 8 }}>
                          <div style={{ fontSize: 10, color: C.danger, textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>Admin: zadat výsledek</div>
                          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                            <input type="number" min="0" placeholder="CZE" value={(resultInput[match.id] || {}).home || ""} onChange={e => setResultInput(r => ({ ...r, [match.id]: { ...(r[match.id] || {}), home: e.target.value } }))} style={{ ...scoreInp, width: 54 }} />
                            <span style={{ color: C.muted, fontSize: 20, fontWeight: 700 }}>:</span>
                            <input type="number" min="0" placeholder="OPP" value={(resultInput[match.id] || {}).away || ""} onChange={e => setResultInput(r => ({ ...r, [match.id]: { ...(r[match.id] || {}), away: e.target.value } }))} style={{ ...scoreInp, width: 54 }} />
                            <button onClick={() => setResult(match.id)} style={{ ...btn, background: C.danger, color: "#fff", flex: 1 }}>Potvrdit ✓</button>
                            <button onClick={() => deleteMatch(match.id)} style={{ ...btn, background: "#3F1010", color: C.danger, fontSize: 16, padding: "8px 12px" }}>🗑</button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}

            {/* Finished matches */}
            {finishedMatches.length > 0 && (
              <>
                <div style={{ fontSize: 10, color: C.muted, textTransform: "uppercase", letterSpacing: 1, margin: "16px 0 8px" }}>Odehrané zápasy</div>
                {finishedMatches.map(match => {
                  const rd = hist.find(h => h.matchId === match.id);
                  const result = { home: String(match.result_home), away: String(match.result_away) };
                  const matchTips = tips.filter(t => t.match_id === match.id);
                  const isEd = editingResult === match.id;
                  return (
                    <div key={match.id} style={{ ...card, marginBottom: 10, background: "#0A0F1A" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
                        <div>
                          <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 18, letterSpacing: 1.5, color: "#64748B" }}>
                            🇨🇿 <span style={{ color: C.gold }}>{match.result_home}:{match.result_away}</span> {match.opponent.toUpperCase()}
                          </div>
                          <div style={{ fontSize: 10, color: "#334155", marginTop: 2 }}>{match.phase} · {match.match_date}</div>
                        </div>
                        <div style={{ display: "flex", gap: 5, alignItems: "center", flexWrap: "wrap", justifyContent: "flex-end" }}>
                          {rd?.winner && <div style={{ fontSize: 11, color: C.gold, fontWeight: 700 }}>🏆 {rd.winner} +{rd.bank}🍺</div>}
                          {!rd?.winner && rd && <div style={{ fontSize: 10, color: C.gold }}>🔄 jackpot</div>}
                          <button onClick={() => { setShowWA(match.id); setWaComment(""); }} style={{ ...smBtn, color: "#25D366", border: "1px solid #25D36633", fontSize: 16, padding: "4px 8px" }}>💬</button>
                          {isAdmin && <>
                            <button onClick={() => setEditingResult(isEd ? null : match.id)} style={{ ...smBtn, color: C.gold, border: `1px solid #FFD60A33` }}>✏</button>
                            <button onClick={() => reopenMatch(match.id)} style={{ ...smBtn, color: "#60A5FA", border: "1px solid #3B82F633" }}>↩</button>
                          </>}
                        </div>
                      </div>

                      {isAdmin && isEd && (
                        <div style={{ background: "#1E293B", borderRadius: 8, padding: "10px 12px", marginBottom: 10, animation: "fadeUp 0.15s ease" }}>
                          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                            <input type="number" min="0" defaultValue={match.result_home} onChange={e => setResultInput(r => ({ ...r, [match.id]: { ...(r[match.id] || {}), home: e.target.value } }))} style={{ ...scoreInp, width: 54 }} />
                            <span style={{ color: C.muted, fontSize: 20, fontWeight: 700 }}>:</span>
                            <input type="number" min="0" defaultValue={match.result_away} onChange={e => setResultInput(r => ({ ...r, [match.id]: { ...(r[match.id] || {}), away: e.target.value } }))} style={{ ...scoreInp, width: 54 }} />
                            <button onClick={() => setResult(match.id)} style={{ ...btn, background: C.danger, color: "#fff", flex: 1 }}>Uložit ✓</button>
                          </div>
                        </div>
                      )}

                      <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
                        {members.map(m => {
                          const tip = matchTips.find(t => t.member_name === m.name);
                          if (!tip?.home_score == null && tip?.home_score !== 0) return (
                            <div key={m.name} style={{ display: "flex", alignItems: "center", gap: 4, background: "rgba(255,255,255,0.02)", border: `1px solid ${C.border}`, borderRadius: 8, padding: "4px 8px" }}>
                              <Avatar member={m} size={16} />
                              <span style={{ fontSize: 10, color: "#1E3A5F" }}>{m.name} —</span>
                            </div>
                          );
                          if (!tip) return null;
                          const pts = calcPts({ home: String(tip.home_score), away: String(tip.away_score) }, result);
                          const pl = PL(pts);
                          const isW = m.name === rd?.winner;
                          return (
                            <div key={m.name} style={{ display: "flex", alignItems: "center", gap: 5, background: isW ? "#FFD60A0A" : `${pl.c}08`, border: `1px solid ${isW ? C.gold : pl.c + "33"}`, borderRadius: 8, padding: "4px 9px" }}>
                              <Avatar member={m} size={18} />
                              <span style={{ fontSize: 10, color: isW ? C.gold : "#94A3B8", fontWeight: isW ? 700 : 400 }}>{isW ? "🏆 " : ""}{m.name}</span>
                              <b style={{ fontSize: 11 }}>{tip.home_score}:{tip.away_score}</b>
                              <span style={{ fontSize: 11, color: pl.c }}>{pl.e}{pts}b</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </>
            )}
          </>
        )}

        {/* ══════ TABULKA ══════ */}
        {tab === "tabulka" && (
          <>
            <div style={{ ...card, marginBottom: 12 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: C.muted, textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 10 }}>Bodování</div>
              {[["🎯 Přesný výsledek","10 b",C.gold],["🥈 Vítěz + rozdíl","6 b",C.green],["✅ Správný vítěz","4 b","#60A5FA"],["🟡 Počet NEBO rozdíl","2 b","#FB923C"],["❌ Nic","0 b",C.danger]].map(([l,p,c])=>(
                <div key={l} style={{display:"flex",justifyContent:"space-between",fontSize:11,marginBottom:4}}>
                  <span style={{color:C.muted}}>{l}</span><span style={{color:c,fontWeight:700}}>{p}</span>
                </div>
              ))}
            </div>
            {ranked.map((m, i) => {
              const s = stats[m.name] || { beers: 0, pts: 0, att: 0, exact: 0 };
              const pct = s.att > 0 ? Math.round(s.pts / (s.att * 10) * 100) : 0;
              const col = COLORS[m.name.charCodeAt(0) % COLORS.length];
              return (
                <div key={m.name} style={{ ...card, marginBottom: 9, background: i===0 ? `linear-gradient(135deg,${col}08,#0F172A)` : "#0F172A", border: `1px solid ${i===0 ? col+"55" : C.border}` }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <div style={{ fontSize: 24, width: 32, textAlign: "center" }}>{["🥇","🥈","🥉"][i]||`${i+1}.`}</div>
                    <Avatar member={m} size={46} ring={i===0} />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 16, fontWeight: 700, color: i===0 ? C.gold : C.text }}>{m.name}</div>
                      <div style={{ fontSize: 10, color: C.muted, marginTop: 1 }}>{s.att} tipů · {s.pts}b · {s.exact}× přesný · {pct}%</div>
                      <div style={{ marginTop: 5, display: "flex", gap: 2, flexWrap: "wrap" }}>
                        {Array.from({length:Math.min(s.beers,20)}).map((_,j)=><span key={j} style={{fontSize:14}}>🍺</span>)}
                        {s.beers>20&&<span style={{fontSize:10,color:C.gold,alignSelf:"center"}}>+{s.beers-20}</span>}
                        {s.beers===0&&<span style={{fontSize:10,color:"#1E293B"}}>Zatím žádné plzničky</span>}
                      </div>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize: 34, color: C.danger, lineHeight: 1 }}>{s.beers}</div>
                      <div style={{ fontSize: 9, color: C.muted }}>PLZNIČEK</div>
                      <div style={{ fontSize: 14, fontWeight: 700, color: "#475569" }}>{s.pts}b</div>
                    </div>
                  </div>
                </div>
              );
            })}
            {finishedMatches.length > 0 && (() => {
              const bk = ranked[0]?.name, pk = [...members].sort((a,b)=>(stats[b.name]?.pts||0)-(stats[a.name]?.pts||0))[0]?.name;
              return bk ? (
                <div style={{ ...card, background:"linear-gradient(135deg,#1A0A0A,#0F172A)", border:`1px solid ${C.danger}44`, marginTop:8 }}>
                  <div style={{ fontSize:16, fontWeight:700, color:C.danger, marginBottom:12 }}>🏆 ULTIMATE WINNER</div>
                  {[[`🍺 Král Plzničky:`,bk,`${stats[bk]?.beers||0} plzniček`],[`🎯 Nejlepší tipér:`,pk,`${stats[pk]?.pts||0} bodů`]].map(([label,name,val])=>(
                    <div key={label} style={{display:"flex",alignItems:"center",gap:10,marginBottom:8}}>
                      <Avatar member={members.find(m=>m.name===name)||{name,photo_url:null}} size={36} ring />
                      <div style={{fontSize:13}}>{label} <span style={{color:C.gold,fontWeight:700}}>{name}</span> <span style={{color:C.muted}}>({val})</span></div>
                    </div>
                  ))}
                  {bk===pk&&<div style={{marginTop:8,color:C.gold,fontWeight:700,fontSize:14}}>🎉 DOUBLE WINNER — {bk} ovládl vše!</div>}
                </div>
              ) : null;
            })()}
          </>
        )}

        {/* ══════ BANKA ══════ */}
        {tab === "banka" && (
          <>
            {carry > 0 && <div style={{...card,background:"linear-gradient(135deg,#1A1200,#0F172A)",border:`1px solid ${C.gold}55`,marginBottom:12,display:"flex",gap:12,alignItems:"center"}}>
              <span style={{fontSize:36}}>🍺</span>
              <div><div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:22,color:C.gold,letterSpacing:2}}>JACKPOT: {carry} Plzniček!</div><div style={{fontSize:11,color:"#92400E"}}>Remíza — přechází dál</div></div>
            </div>}
            {hist.length===0&&<div style={{textAlign:"center",padding:50,color:C.muted}}><div style={{fontSize:40}}>🍺</div><div style={{marginTop:8}}>Žádné odehrané zápasy.</div></div>}
            {hist.map(r=>{
              const match=matches.find(m=>m.id===r.matchId);
              if(!match)return null;
              return(
                <div key={r.matchId} style={{...card,marginBottom:10,border:`1px solid ${r.winner?C.danger+"33":C.gold+"22"}`}}>
                  <div style={{display:"flex",justifyContent:"space-between",marginBottom:8}}>
                    <div>
                      <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:17,letterSpacing:1.5,color:"#64748B"}}>🇨🇿 <span style={{color:C.gold}}>{match.result_home}:{match.result_away}</span> {match.opponent.toUpperCase()}</div>
                      <div style={{fontSize:10,color:"#334155"}}>{match.match_date} · {match.phase}</div>
                    </div>
                    <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:24,color:C.gold}}>{r.bank}🍺</div>
                  </div>
                  <div style={{display:"flex",flexWrap:"wrap",gap:5,marginBottom:8}}>
                    {r.scored.map(({name,p})=>{
                      const pl=PL(p),isW=name===r.winner,mo=members.find(m=>m.name===name)||{name,photo_url:null};
                      const tip=tips.find(t=>t.match_id===match.id&&t.member_name===name);
                      return(<div key={name} style={{display:"flex",alignItems:"center",gap:5,background:isW?"#FFD60A0A":`${pl.c}08`,border:`1px solid ${isW?C.gold:pl.c+"33"}`,borderRadius:8,padding:"4px 9px"}}>
                        <Avatar member={mo} size={18}/><span style={{fontSize:10,color:isW?C.gold:"#94A3B8",fontWeight:isW?700:400}}>{isW?"🏆 ":""}{name}</span>
                        <b style={{fontSize:11}}>{tip?.home_score}:{tip?.away_score}</b><span style={{fontSize:11,color:pl.c}}>{pl.e}{p}b</span>
                      </div>);
                    })}
                  </div>
                  {r.winner?<div style={{background:"#FFD60A0A",border:`1px solid ${C.gold}33`,borderRadius:8,padding:"7px 12px",fontSize:12,color:C.gold,fontWeight:700}}>🏆 {r.winner} bere {r.bank} Plzniček!</div>
                  :<div style={{background:"#1A1200",border:`1px solid ${C.gold}22`,borderRadius:8,padding:"7px 12px",fontSize:11,color:"#92400E"}}>🔄 Remíza — přechází dál</div>}
                </div>
              );
            })}
          </>
        )}

        {/* ══════ VYROVNÁNÍ ══════ */}
        {tab === "vyrovnani" && (
          <>
            {tx.length===0&&<div style={{textAlign:"center",padding:50}}><div style={{fontSize:40}}>{finishedMatches.length===0?"⏳":"🤝"}</div><div style={{color:C.muted,marginTop:8,fontSize:13}}>{finishedMatches.length===0?"Zatím žádné výsledky.":"Všichni vyrovnaní!"}</div></div>}
            {tx.map((t,i)=>{
              const fm=members.find(m=>m.name===t.from)||{name:t.from,photo_url:null};
              const tm=members.find(m=>m.name===t.to)||{name:t.to,photo_url:null};
              return(<div key={i} style={{...card,marginBottom:10,display:"flex",alignItems:"center",gap:12,border:`1px solid ${C.danger}22`}}>
                <div style={{flex:1,textAlign:"center"}}><Avatar member={fm} size={44}/><div style={{fontSize:14,fontWeight:700,color:C.danger,marginTop:4}}>{t.from}</div><div style={{fontSize:10,color:C.muted}}>kupuje</div></div>
                <div style={{textAlign:"center"}}><div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:28,color:C.gold}}>{t.b}×🍺</div><div style={{fontSize:24,color:C.muted}}>→</div></div>
                <div style={{flex:1,textAlign:"center"}}><Avatar member={tm} size={44}/><div style={{fontSize:14,fontWeight:700,color:C.green,marginTop:4}}>{t.to}</div><div style={{fontSize:10,color:C.muted}}>dostane</div></div>
              </div>);
            })}
            {finishedMatches.length > 0 && (
              <div style={{marginTop:14}}>
                <div style={{fontSize:10,color:C.muted,textTransform:"uppercase",letterSpacing:1,marginBottom:8}}>Čistá bilance</div>
                {members.map(m=>{
                  const v=net[m.name]||0;
                  return(<div key={m.name} style={{...card,marginBottom:6,padding:"9px 14px",display:"flex",alignItems:"center",gap:8,justifyContent:"space-between",background:"#0A0F1A"}}>
                    <div style={{display:"flex",alignItems:"center",gap:8}}><Avatar member={m} size={28}/><span style={{fontSize:13,fontWeight:600}}>{m.name}</span></div>
                    <span style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:20,color:v>0?C.green:v<0?C.danger:C.muted}}>{v>0?`+${v} 🍺`:v<0?`${v} 🍺`:"±0"}</span>
                  </div>);
                })}
              </div>
            )}
          </>
        )}

        {/* ══════ ARCHIV ══════ */}
        {tab === "archiv" && (
          <>
            {seasons.map(s=>{
              const isCur=s.id===activeSeason?.id;
              return(<div key={s.id} style={{...card,marginBottom:10,border:`1px solid ${isCur?C.accent+"66":C.border}`,background:isCur?"#0F1F33":C.surface}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}}>
                  <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:22,letterSpacing:2,color:isCur?C.accent:"#475569"}}>MS {s.year} {isCur&&"← nyní"}</div>
                  {!isCur&&<button onClick={()=>switchSeason(s.id)} style={{...smBtn,color:"#60A5FA",border:"1px solid #3B82F633"}}>Přepnout</button>}
                </div>
                <div style={{fontSize:11,color:C.muted}}>{s.name}</div>
              </div>);
            })}
          </>
        )}
      </div>
    </div>
  );
}
