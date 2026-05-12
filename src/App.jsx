import React, { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from './supabase';
import { calcPts, ptLabel, bankHistory, overallStats, settlement, buildWA, memberColor, MEMBER_COLORS } from './logic';
import { Avatar, Notification, Modal, ScoreInput, card, inp, btn, smBtn } from './components';
import LiveWidget from './LiveWidget';

const OPPONENTS = ['Slovensko','Německo','Švýcarsko','Norsko','Švédsko','Finsko','Kanada','USA','Lotyšsko','Dánsko','Rakousko','Maďarsko','Francie','Kazachstán','Velká Británie','Bělorusko','Itálie','Slovinsko'];

// ── GLOBAL CSS ────────────────────────────────────────────────────────────────
const GlobalCSS = () => (
  <style>{`
    @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=DM+Sans:wght@400;500;700&display=swap');
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body { background: #080D16; color: #F1F5F9; font-family: 'DM Sans', system-ui, sans-serif; -webkit-tap-highlight-color: transparent; }
    ::-webkit-scrollbar { width: 3px; } ::-webkit-scrollbar-thumb { background: #334155; border-radius: 4px; }
    @keyframes livePulse { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:.4;transform:scale(.7)} }
    @keyframes fadeUp { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }
    input[type=number]::-webkit-inner-spin-button { opacity: 1; }
    input, select, button { font-family: 'DM Sans', system-ui, sans-serif; }
    select option { background: #1E293B; color: #F1F5F9; }
    .tap:active { transform: scale(0.96); }
  `}</style>
);

export default function App() {
  // ── State ──────────────────────────────────────────────────────────────────
  const [seasons, setSeasons] = useState([]);
  const [activeSeason, setActiveSeason] = useState(null);
  const [members, setMembers] = useState([]);
  const [matches, setMatches] = useState([]);
  const [tips, setTips] = useState([]);
  const [me, setMe] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [tab, setTab] = useState('zapasy');
  const [loading, setLoading] = useState(true);
  const [notif, setNotif] = useState(null);

  // Modals & forms
  const [showLogin, setShowLogin] = useState(false);
  const [adminPwd, setAdminPwd] = useState('');
  const [adminErr, setAdminErr] = useState(false);
  const [showAddMatch, setShowAddMatch] = useState(false);
  const [showAddMember, setShowAddMember] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showWA, setShowWA] = useState(null);
  const [showPhotoEdit, setShowPhotoEdit] = useState(null);
  const [showAddSeason, setShowAddSeason] = useState(false);
  const [expandedMatch, setExpandedMatch] = useState(null);
  const [editingResult, setEditingResult] = useState(null);

  // Form data
  const [newMatch, setNewMatch] = useState({ opponent: '', custom: '', date: '', time: '16:20', phase: 'Skupina' });
  const [customOpp, setCustomOpp] = useState(false);
  const [newMemberName, setNewMemberName] = useState('');
  const [newSeasonYear, setNewSeasonYear] = useState('');
  const [resultInput, setResultInput] = useState({});
  const [waComment, setWaComment] = useState('');
  const [settingsForm, setSettingsForm] = useState({});
  const [manualLive, setManualLive] = useState({});
  const [showManualLive, setShowManualLive] = useState(false);
  const photoRef = useRef(null);

  // ── Notify helper ──────────────────────────────────────────────────────────
  const notify = useCallback((msg, type = 'ok') => {
    setNotif({ msg, type });
    setTimeout(() => setNotif(null), 3000);
  }, []);

  // ── Load data ──────────────────────────────────────────────────────────────
  const loadAll = useCallback(async () => {
    setLoading(true);
    const { data: seasonsData } = await supabase.from('seasons').select('*').order('year', { ascending: false });
    setSeasons(seasonsData || []);

    const active = (seasonsData || [])[0];
    if (!active) { setLoading(false); return; }
    setActiveSeason(active);

    const [{ data: membersData }, { data: matchesData }, { data: tipsData }] = await Promise.all([
      supabase.from('members').select('*').eq('season_id', active.id).order('id'),
      supabase.from('matches').select('*').eq('season_id', active.id).order('match_date'),
      supabase.from('tips').select('*').in('match_id', (await supabase.from('matches').select('id').eq('season_id', active.id)).data?.map(m => m.id) || []),
    ]);
    setMembers(membersData || []);
    setMatches(matchesData || []);
    setTips(tipsData || []);
    setMe(prev => prev || membersData?.[0]?.name || null);
    setLoading(false);
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);

  // Reload tips & matches for current season
  const reloadTips = async () => {
    if (!activeSeason) return;
    const mids = matches.map(m => m.id);
    if (!mids.length) return;
    const { data } = await supabase.from('tips').select('*').in('match_id', mids);
    setTips(data || []);
  };

  const reloadMatches = async () => {
    if (!activeSeason) return;
    const { data } = await supabase.from('matches').select('*').eq('season_id', activeSeason.id).order('match_date');
    setMatches(data || []);
  };

  // ── Switch season ──────────────────────────────────────────────────────────
  const switchSeason = async (seasonId) => {
    const s = seasons.find(x => x.id === parseInt(seasonId));
    if (!s) return;
    setActiveSeason(s);
    setTab('zapasy');
    const [{ data: membersData }, { data: matchesData }] = await Promise.all([
      supabase.from('members').select('*').eq('season_id', s.id).order('id'),
      supabase.from('matches').select('*').eq('season_id', s.id).order('match_date'),
    ]);
    setMembers(membersData || []);
    setMatches(matchesData || []);
    const mids = (matchesData || []).map(m => m.id);
    if (mids.length) {
      const { data: tipsData } = await supabase.from('tips').select('*').in('match_id', mids);
      setTips(tipsData || []);
    } else setTips([]);
    setMe(membersData?.[0]?.name || null);
  };

  // ── Admin ──────────────────────────────────────────────────────────────────
  const tryAdmin = () => {
    if (adminPwd === activeSeason?.admin_password) {
      setIsAdmin(true); setShowLogin(false); setAdminPwd(''); setAdminErr(false);
      notify('🔓 Admin přihlášen');
    } else setAdminErr(true);
  };

  // ── Add match ──────────────────────────────────────────────────────────────
  const addMatch = async () => {
    const opp = customOpp ? newMatch.custom.trim() : newMatch.opponent;
    if (!opp || !newMatch.date) { notify('Vyplň soupeře a datum!', 'warn'); return; }
    const { error } = await supabase.from('matches').insert({
      season_id: activeSeason.id, opponent: opp,
      match_date: newMatch.date, match_time: newMatch.time, phase: newMatch.phase,
    });
    if (error) { notify('Chyba: ' + error.message, 'warn'); return; }
    await reloadMatches();
    setNewMatch({ opponent: '', custom: '', date: '', time: '16:20', phase: 'Skupina' });
    setShowAddMatch(false); notify('✅ Zápas přidán');
  };

  const deleteMatch = async (id) => {
    await supabase.from('tips').delete().eq('match_id', id);
    await supabase.from('matches').delete().eq('id', id);
    await reloadMatches();
    setTips(prev => prev.filter(t => t.match_id !== id));
    notify('Zápas smazán');
  };

  const setResult = async (matchId, home, away) => {
    if (home === '' || away === '' || home == null) { notify('Zadej oba góly!', 'warn'); return; }
    const { error } = await supabase.from('matches').update({ status: 'finished', result_home: +home, result_away: +away }).eq('id', matchId);
    if (error) { notify('Chyba: ' + error.message, 'warn'); return; }
    await reloadMatches();
    setEditingResult(null); notify('✅ Výsledek uložen');
  };

  const reopenMatch = async (id) => {
    await supabase.from('matches').update({ status: 'upcoming', result_home: null, result_away: null }).eq('id', id);
    await reloadMatches(); notify('Zápas znovu otevřen');
  };

  // ── Tip ───────────────────────────────────────────────────────────────────
  const saveTip = async (matchId, memberName, home, away) => {
    // Unique check
    const duplicate = tips.find(t => t.match_id === matchId && t.member_name !== memberName && String(t.home) === String(home) && String(t.away) === String(away) && t.home != null);
    if (duplicate && home !== '' && away !== '') {
      notify('⚠ Tento výsledek už tipoval/a ' + duplicate.member_name + '!', 'warn'); return;
    }
    const { error } = await supabase.from('tips').upsert(
      { match_id: matchId, member_name: memberName, home: home !== '' ? +home : null, away: away !== '' ? +away : null, updated_at: new Date().toISOString() },
      { onConflict: 'match_id,member_name' }
    );
    if (error) { notify('Chyba uložení: ' + error.message, 'warn'); return; }
    await reloadTips();
  };

  const getTip = (matchId, memberName) =>
    tips.find(t => t.match_id === matchId && t.member_name === memberName) || { home: '', away: '' };

  // ── Members ───────────────────────────────────────────────────────────────
  const addMember = async () => {
    const name = newMemberName.trim();
    if (!name || members.find(m => m.name === name)) { notify('Jméno prázdné nebo existuje!', 'warn'); return; }
    const { error } = await supabase.from('members').insert({ season_id: activeSeason.id, name });
    if (error) { notify('Chyba: ' + error.message, 'warn'); return; }
    const { data } = await supabase.from('members').select('*').eq('season_id', activeSeason.id).order('id');
    setMembers(data || []);
    setNewMemberName(''); setShowAddMember(false); notify(`✅ ${name} přidán/a`);
  };

  const removeMember = async (id, name) => {
    await supabase.from('members').delete().eq('id', id);
    setMembers(prev => prev.filter(m => m.id !== id));
    if (me === name) setMe(members.filter(m => m.name !== name)[0]?.name || null);
    notify(`${name} odebrán/a`);
  };

  const uploadPhoto = async (memberId, file) => {
    if (!file) return;
    // Upload to Supabase Storage (bucket: avatars)
    const ext = file.name.split('.').pop();
    const path = `${memberId}.${ext}`;
    const { error: upErr } = await supabase.storage.from('avatars').upload(path, file, { upsert: true });
    if (upErr) {
      // Fallback: store as base64 in DB directly
      const reader = new FileReader();
      reader.onload = async e => {
        await supabase.from('members').update({ photo_url: e.target.result }).eq('id', memberId);
        const { data } = await supabase.from('members').select('*').eq('season_id', activeSeason.id).order('id');
        setMembers(data || []); notify('📸 Fotka uložena!');
      };
      reader.readAsDataURL(file);
      return;
    }
    const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(path);
    await supabase.from('members').update({ photo_url: publicUrl }).eq('id', memberId);
    const { data } = await supabase.from('members').select('*').eq('season_id', activeSeason.id).order('id');
    setMembers(data || []); notify('📸 Fotka uložena!');
  };

  // ── Seasons ───────────────────────────────────────────────────────────────
  const addSeason = async () => {
    const y = parseInt(newSeasonYear);
    if (!y || y < 2000 || y > 2200) { notify('Zadej platný rok!', 'warn'); return; }
    if (seasons.find(s => s.year === y)) { notify('Ročník existuje!', 'warn'); return; }
    const { data: newS, error } = await supabase.from('seasons').insert({ year: y }).select().single();
    if (error) { notify('Chyba: ' + error.message, 'warn'); return; }
    // Copy members from current season
    if (members.length) {
      await supabase.from('members').insert(members.map(m => ({ season_id: newS.id, name: m.name })));
    }
    const { data: allSeasons } = await supabase.from('seasons').select('*').order('year', { ascending: false });
    setSeasons(allSeasons || []);
    await switchSeason(newS.id);
    setNewSeasonYear(''); setShowAddSeason(false); notify(`✅ Ročník ${y} vytvořen`);
  };

  // ── Settings ──────────────────────────────────────────────────────────────
  const saveSettings = async () => {
    const updates = {};
    if (settingsForm.appName) updates.app_name = settingsForm.appName;
    if (settingsForm.wa) updates.wa_group = settingsForm.wa;
    if (settingsForm.pwd) updates.admin_password = settingsForm.pwd;
    if (settingsForm.api !== undefined) updates.api_key = settingsForm.api;
    if (Object.keys(updates).length) {
      await supabase.from('seasons').update(updates).eq('id', activeSeason.id);
      const { data } = await supabase.from('seasons').select('*').eq('id', activeSeason.id).single();
      setActiveSeason(data);
      setSeasons(prev => prev.map(s => s.id === data.id ? data : s));
    }
    setShowSettings(false); notify('✅ Nastavení uloženo');
  };

  // ── Derived data ──────────────────────────────────────────────────────────
  const { hist, carry } = bankHistory(matches, tips, members);
  const stats = overallStats(matches, tips, members, hist);
  const { net, tx } = settlement(members, hist);
  const ranked = [...members].sort((a, b) =>
    (stats[b.name]?.beers || 0) !== (stats[a.name]?.beers || 0)
      ? (stats[b.name]?.beers || 0) - (stats[a.name]?.beers || 0)
      : (stats[b.name]?.pts || 0) - (stats[a.name]?.pts || 0)
  );
  const finishedMatches = matches.filter(m => m.status === 'finished');
  const upcomingMatches = matches.filter(m => m.status === 'upcoming');
  const nextMatch = upcomingMatches[0] || null;
  const meObj = members.find(m => m.name === me);
  const apiKey = activeSeason?.api_key || '';

  // ── Render ────────────────────────────────────────────────────────────────
  if (loading) return (
    <>
      <GlobalCSS />
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 12, background: '#080D16' }}>
        <div style={{ fontSize: 40 }}>🍺</div>
        <div style={{ color: '#334155', fontSize: 14 }}>Načítám tipovačku…</div>
      </div>
    </>
  );

  if (!activeSeason) return (
    <>
      <GlobalCSS />
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 16, padding: 24, background: '#080D16' }}>
        <div style={{ fontSize: 14, color: '#475569', textAlign: 'center', lineHeight: 1.8 }}>
          ⚠ Supabase není připojeno.<br />
          Zkontroluj <code style={{ background: '#1E293B', padding: '2px 6px', borderRadius: 4 }}>.env.local</code> nebo Netlify environment variables.
        </div>
      </div>
    </>
  );

  return (
    <>
      <GlobalCSS />

      {/* ── HEADER ── */}
      <div style={{ background: 'linear-gradient(180deg,#0F172A,#080D16)', borderBottom: '1px solid #1E293B', padding: '12px 14px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
            <span style={{ fontSize: 22, flexShrink: 0 }}>🍺</span>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 19, letterSpacing: 2, color: '#FFD60A', lineHeight: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {activeSeason.app_name || 'Tipovačka o Plzničku'}
              </div>
              <div style={{ fontSize: 9, color: '#334155', letterSpacing: 2, textTransform: 'uppercase', marginTop: 1 }}>
                MS Hokej {activeSeason.year} · 🇨🇿
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 5, alignItems: 'center', flexShrink: 0 }}>
            {carry > 0 && (
              <div style={{ background: '#FFD60A15', border: '1px solid #FFD60A44', borderRadius: 20, padding: '3px 8px', display: 'flex', alignItems: 'center', gap: 4 }}>
                <span style={{ fontSize: 12 }}>🍺</span>
                <span style={{ fontSize: 11, color: '#FFD60A', fontWeight: 700 }}>{carry}</span>
              </div>
            )}
            {seasons.length > 1 && (
              <select value={activeSeason.id} onChange={e => switchSeason(e.target.value)} style={{ background: '#1E293B', border: '1px solid #334155', borderRadius: 7, padding: '5px 6px', color: '#64748B', fontSize: 11, cursor: 'pointer' }}>
                {seasons.map(s => <option key={s.id} value={s.id}>{s.year}</option>)}
              </select>
            )}
            {isAdmin
              ? <button onClick={() => { setIsAdmin(false); notify('🔒 Odhlášen'); }} className="tap" style={{ ...smBtn('#FFD60A15'), color: '#FFD60A', border: '1px solid #FFD60A33' }}>🔓</button>
              : <button onClick={() => setShowLogin(!showLogin)} className="tap" style={{ ...smBtn(), border: '1px solid #1E293B' }}>🔐</button>
            }
          </div>
        </div>

        {/* Admin login */}
        {showLogin && !isAdmin && (
          <div style={{ marginTop: 10, display: 'flex', gap: 8, animation: 'fadeUp 0.2s ease' }}>
            <input type="password" placeholder="Heslo admina…" value={adminPwd} onChange={e => { setAdminPwd(e.target.value); setAdminErr(false); }} onKeyDown={e => e.key === 'Enter' && tryAdmin()} style={{ ...inp, borderColor: adminErr ? '#EF4444' : '#334155' }} />
            <button onClick={tryAdmin} className="tap" style={{ ...btn('#3B82F6', '#fff'), minWidth: 44 }}>→</button>
          </div>
        )}

        {/* Admin toolbar */}
        {isAdmin && (
          <div style={{ marginTop: 8, display: 'flex', gap: 5, flexWrap: 'wrap' }}>
            <button onClick={() => { setSettingsForm({ appName: activeSeason.app_name, wa: activeSeason.wa_group, api: activeSeason.api_key || '', pwd: '' }); setShowSettings(true); }} className="tap" style={{ ...smBtn('#FFD60A'), border: '1px solid #FFD60A33' }}>⚙ Nastavení</button>
            <button onClick={() => setShowAddSeason(!showAddSeason)} className="tap" style={{ ...smBtn('#60A5FA'), border: '1px solid #3B82F633' }}>+ Ročník</button>
            <button onClick={() => setShowManualLive(!showManualLive)} className="tap" style={{ ...smBtn('#34D399'), border: '1px solid #34D39933' }}>📡 Ruční skóre</button>
          </div>
        )}

        {/* Manual live */}
        {isAdmin && showManualLive && (
          <div style={{ marginTop: 10, background: '#1E293B', borderRadius: 10, padding: '10px 12px', border: '1px solid #334155', animation: 'fadeUp 0.2s ease' }}>
            <div style={{ fontSize: 10, color: '#475569', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 1 }}>Ruční live skóre (bez API)</div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <ScoreInput value={manualLive.homeScore} onChange={v => setManualLive(x => ({ ...x, homeScore: v, home: v }))} placeholder="CZE" />
              <span style={{ color: '#334155', fontWeight: 700 }}>:</span>
              <ScoreInput value={manualLive.awayScore} onChange={v => setManualLive(x => ({ ...x, awayScore: v, away: v }))} placeholder="OPP" />
              <input placeholder="Status (2. třetina…)" value={manualLive.status || ''} onChange={e => setManualLive(x => ({ ...x, status: e.target.value }))} style={{ ...inp, flex: 1, fontSize: 11 }} />
              <button onClick={() => setManualLive({})} style={{ ...smBtn('#EF4444') }}>✕</button>
            </div>
          </div>
        )}

        {/* Add season */}
        {isAdmin && showAddSeason && (
          <div style={{ marginTop: 10, display: 'flex', gap: 8, animation: 'fadeUp 0.2s ease' }}>
            <input type="number" placeholder="Rok (2027)" value={newSeasonYear} onChange={e => setNewSeasonYear(e.target.value)} onKeyDown={e => e.key === 'Enter' && addSeason()} style={{ ...inp, flex: 1 }} />
            <button onClick={addSeason} className="tap" style={{ ...btn('#1D4ED8', '#fff') }}>Vytvořit</button>
            <button onClick={() => setShowAddSeason(false)} className="tap" style={smBtn()}>✕</button>
          </div>
        )}
      </div>

      {/* ── USER BAR ── */}
      <div style={{ background: '#080D16', borderBottom: '1px solid #0F172A', padding: '8px 12px', display: 'flex', alignItems: 'center', gap: 6, overflowX: 'auto' }}>
        <span style={{ fontSize: 9, color: '#1E293B', whiteSpace: 'nowrap', textTransform: 'uppercase', letterSpacing: 1.5 }}>Já:</span>
        {members.map(m => (
          <button key={m.id} onClick={() => setMe(m.name)} className="tap" style={{ display: 'flex', alignItems: 'center', gap: 5, background: me === m.name ? '#1E3A5F' : 'rgba(255,255,255,0.03)', border: `1px solid ${me === m.name ? '#3B82F6' : '#0F172A'}`, borderRadius: 20, padding: '3px 10px 3px 4px', cursor: 'pointer', flexShrink: 0, transition: 'all 0.15s' }}>
            <Avatar member={m} size={24} ring={me === m.name} />
            <span style={{ fontSize: 11, color: me === m.name ? '#93C5FD' : '#334155', fontWeight: me === m.name ? 700 : 400 }}>{m.name}</span>
          </button>
        ))}
        {isAdmin && <button onClick={() => setShowAddMember(!showAddMember)} className="tap" style={{ ...smBtn('#334155'), border: '1px dashed #1E293B', flexShrink: 0 }}>+ člen</button>}
      </div>

      {/* Admin: manage members */}
      {isAdmin && showAddMember && (
        <div style={{ background: '#080D16', borderBottom: '1px solid #0F172A', padding: '10px 12px', animation: 'fadeUp 0.2s ease' }}>
          <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
            <input value={newMemberName} onChange={e => setNewMemberName(e.target.value)} onKeyDown={e => e.key === 'Enter' && addMember()} placeholder="Jméno nového člena…" style={{ ...inp, flex: 1 }} />
            <button onClick={addMember} className="tap" style={{ ...btn('#166534', '#34D399') }}>Přidat</button>
          </div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {members.map(m => (
              <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: 5, background: '#0F172A', border: '1px solid #1E293B', borderRadius: 10, padding: '4px 8px' }}>
                <Avatar member={m} size={22} />
                <span style={{ fontSize: 11, color: '#475569' }}>{m.name}</span>
                <button onClick={() => setShowPhotoEdit(m)} style={{ background: 'none', border: 'none', color: '#FFD60A', cursor: 'pointer', fontSize: 12 }}>📸</button>
                <button onClick={() => removeMember(m.id, m.name)} style={{ background: 'none', border: 'none', color: '#EF4444', cursor: 'pointer', fontSize: 14 }}>×</button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Notification */}
      <Notification notif={notif} />

      {/* Photo modal */}
      {showPhotoEdit && (
        <Modal onClose={() => setShowPhotoEdit(null)}>
          <div style={{ fontSize: 15, fontWeight: 700, color: '#FFD60A', marginBottom: 14 }}>Fotka — {showPhotoEdit.name}</div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
            <Avatar member={showPhotoEdit} size={80} ring />
            <input ref={photoRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={e => { uploadPhoto(showPhotoEdit.id, e.target.files[0]); setShowPhotoEdit(null); }} />
            <button onClick={() => photoRef.current?.click()} className="tap" style={{ ...btn('#1E3A5F', '#93C5FD'), width: '100%' }}>📸 Nahrát fotku</button>
            {showPhotoEdit.photo_url && (
              <button onClick={async () => { await supabase.from('members').update({ photo_url: null }).eq('id', showPhotoEdit.id); const { data } = await supabase.from('members').select('*').eq('season_id', activeSeason.id).order('id'); setMembers(data || []); setShowPhotoEdit(null); notify('Fotka odstraněna'); }} className="tap" style={{ ...btn('#3F1010', '#EF4444'), width: '100%' }}>🗑 Odebrat</button>
            )}
            <button onClick={() => setShowPhotoEdit(null)} style={smBtn()}>Zavřít</button>
          </div>
        </Modal>
      )}

      {/* Settings modal */}
      {showSettings && isAdmin && (
        <Modal onClose={() => setShowSettings(false)}>
          <div style={{ fontSize: 15, fontWeight: 700, color: '#FFD60A', marginBottom: 16 }}>⚙ Nastavení</div>
          {[['Název aplikace', 'appName', 'text', activeSeason.app_name], ['WA skupina', 'wa', 'text', activeSeason.wa_group], ['Nové heslo admina', 'pwd', 'password', '(ponechat)']].map(([label, key, type, ph]) => (
            <div key={key} style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 11, color: '#475569', marginBottom: 4 }}>{label}</div>
              <input type={type} placeholder={ph} value={settingsForm[key] || ''} onChange={e => setSettingsForm(f => ({ ...f, [key]: e.target.value }))} style={inp} />
            </div>
          ))}
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 11, color: '#475569', marginBottom: 4 }}>API klíč (live skóre — api-sports.io)</div>
            <input placeholder="Získáš zdarma na api-sports.io" value={settingsForm.api ?? ''} onChange={e => setSettingsForm(f => ({ ...f, api: e.target.value }))} style={inp} />
            <div style={{ fontSize: 10, color: '#1D4ED8', marginTop: 4 }}>→ Registrace zdarma, 100 requestů/den</div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={saveSettings} className="tap" style={{ ...btn('#3B82F6', '#fff'), flex: 1 }}>Uložit</button>
            <button onClick={() => setShowSettings(false)} className="tap" style={{ ...btn(), flex: 1 }}>Zrušit</button>
          </div>
        </Modal>
      )}

      {/* WA modal */}
      {showWA && (() => {
        const match = matches.find(m => m.id === showWA);
        if (!match) return null;
        const msg = buildWA(match, tips, members, hist, waComment, activeSeason.app_name);
        return (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.92)', zIndex: 300, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }} onClick={() => setShowWA(null)}>
            <div style={{ background: '#0F172A', borderTop: '1px solid #25D36644', borderRadius: '16px 16px 0 0', padding: '20px 16px 36px', width: '100%', maxWidth: 480, animation: 'fadeUp 0.2s ease' }} onClick={e => e.stopPropagation()}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                <div style={{ width: 30, height: 30, background: '#25D366', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>💬</div>
                <span style={{ fontSize: 15, fontWeight: 700, color: '#25D366' }}>Sdílet na WhatsApp</span>
              </div>
              <div style={{ background: '#080D16', borderRadius: 10, padding: '10px 12px', marginBottom: 12, fontSize: 11, color: '#64748B', whiteSpace: 'pre-wrap', maxHeight: 200, overflowY: 'auto', lineHeight: 1.6, border: '1px solid #1E293B' }}>{msg}</div>
              <input value={waComment} onChange={e => setWaComment(e.target.value)} placeholder="Přidat komentář…" style={{ ...inp, marginBottom: 14 }} />
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={() => { window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank'); setShowWA(null); }} className="tap" style={{ ...btn('#16A34A', '#fff'), flex: 2, fontSize: 14 }}>Otevřít WhatsApp →</button>
                <button onClick={() => setShowWA(null)} className="tap" style={{ ...btn(), flex: 1 }}>Zrušit</button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ── TABS ── */}
      <div style={{ display: 'flex', background: '#080D16', borderBottom: '1px solid #0F172A', position: 'sticky', top: 0, zIndex: 10 }}>
        {[['zapasy','🏒 Zápasy'],['tabulka','📊 Tabulka'],['banka','🍺 Banka'],['vyrovnani','💸 Vyrovnání'],['archiv','📁 Archiv']].map(([id, label]) => (
          <button key={id} onClick={() => setTab(id)} className="tap" style={{ flex: 1, padding: '11px 2px', background: 'none', border: 'none', borderBottom: `2px solid ${tab === id ? '#3B82F6' : 'transparent'}`, color: tab === id ? '#3B82F6' : '#334155', cursor: 'pointer', fontSize: 9.5, fontWeight: tab === id ? 700 : 400, transition: 'all 0.15s' }}>
            {label}
          </button>
        ))}
      </div>

      {/* ── CONTENT ── */}
      <div style={{ padding: '12px 12px 80px' }}>

        {/* ══ ZÁPASY ══ */}
        {tab === 'zapasy' && (
          <>
            <LiveWidget
              match={nextMatch}
              tips={tips}
              members={members}
              apiKey={apiKey}
              manualScore={Object.keys(manualLive).length > 0 ? manualLive : null}
              isAdmin={isAdmin}
              onSaveResult={async result => {
                if (!nextMatch) return;
                await setResult(nextMatch.id, result.home, result.away);
                notify('✅ Výsledek z API uložen!');
              }}
            />

            {!apiKey && isAdmin && (
              <div style={{ background: '#1E3A5F22', border: '1px solid #1D4ED844', borderRadius: 10, padding: '10px 12px', marginBottom: 12, fontSize: 11, color: '#60A5FA', lineHeight: 1.6 }}>
                💡 <b>Pro automatické live skóre</b> přidej API klíč v ⚙ Nastavení (api-sports.io, zdarma).
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <span style={{ fontSize: 10, color: '#334155', textTransform: 'uppercase', letterSpacing: 1 }}>Zápasy {activeSeason.year}</span>
              {isAdmin && <button onClick={() => setShowAddMatch(!showAddMatch)} className="tap" style={{ ...btn('#EF4444', '#fff'), fontSize: 12, padding: '7px 14px' }}>+ Zápas</button>}
            </div>

            {/* Add match form */}
            {isAdmin && showAddMatch && (
              <div style={{ ...card, marginBottom: 12, animation: 'fadeUp 0.2s ease' }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#FFD60A', marginBottom: 12, textTransform: 'uppercase', letterSpacing: 1 }}>Nový zápas — 🇨🇿 Česko vs:</div>
                {!customOpp
                  ? <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                      <select value={newMatch.opponent} onChange={e => setNewMatch(f => ({ ...f, opponent: e.target.value }))} style={{ ...inp, flex: 1 }}>
                        <option value="">Vybrat soupeře…</option>
                        {OPPONENTS.map(o => <option key={o} value={o}>{o}</option>)}
                      </select>
                      <button onClick={() => setCustomOpp(true)} className="tap" style={{ ...smBtn('#FFD60A'), border: '1px solid #FFD60A33' }}>Vlastní</button>
                    </div>
                  : <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                      <input value={newMatch.custom} onChange={e => setNewMatch(f => ({ ...f, custom: e.target.value }))} placeholder="Napsat soupeře…" style={{ ...inp, flex: 1 }} />
                      <button onClick={() => setCustomOpp(false)} className="tap" style={smBtn()}>← Seznam</button>
                    </div>
                }
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
                  <input type="date" value={newMatch.date} onChange={e => setNewMatch(f => ({ ...f, date: e.target.value }))} style={inp} />
                  <input type="time" value={newMatch.time} onChange={e => setNewMatch(f => ({ ...f, time: e.target.value }))} style={inp} />
                </div>
                <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginBottom: 12 }}>
                  {['Skupina','Čtvrtfinále','Semifinále','Finále','Bronz','Baráž'].map(p => (
                    <button key={p} onClick={() => setNewMatch(f => ({ ...f, phase: p }))} className="tap" style={{ ...smBtn(newMatch.phase === p ? '#93C5FD' : '#475569'), background: newMatch.phase === p ? '#1D4ED8' : 'rgba(255,255,255,0.04)', border: `1px solid ${newMatch.phase === p ? '#3B82F6' : '#1E293B'}` }}>{p}</button>
                  ))}
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={addMatch} className="tap" style={{ ...btn('#EF4444', '#fff'), flex: 1 }}>Uložit</button>
                  <button onClick={() => setShowAddMatch(false)} className="tap" style={{ ...btn(), flex: 1 }}>Zrušit</button>
                </div>
              </div>
            )}

            {/* Upcoming matches */}
            {upcomingMatches.map(match => {
              const expanded = expandedMatch === match.id;
              const tipCount = members.filter(m => { const t = getTip(match.id, m.name); return t.home != null && t.home !== ''; }).length;
              const myTip = getTip(match.id, me);
              const hasMine = myTip.home != null && myTip.home !== '';

              return (
                <div key={match.id} style={{ ...card, marginBottom: 10, border: `1px solid ${expanded ? '#3B82F666' : '#1E293B'}`, transition: 'border-color 0.2s' }}>
                  <div onClick={() => setExpandedMatch(expanded ? null : match.id)} style={{ cursor: 'pointer' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 19, letterSpacing: 1.5, color: '#F1F5F9' }}>
                          🇨🇿 Česko <span style={{ color: '#334155', fontSize: 14 }}>vs</span> {match.opponent.toUpperCase()}
                        </div>
                        <div style={{ fontSize: 10, color: '#334155', marginTop: 2 }}>{match.phase} · {match.match_date}{match.match_time ? ` · ${match.match_time}` : ''}</div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: 12, color: '#FFD60A' }}>🍺 {tipCount + carry}</div>
                        <div style={{ fontSize: 9, color: '#1E293B' }}>{tipCount}/{members.length}</div>
                        <div style={{ color: '#334155', fontSize: 12, marginTop: 2 }}>{expanded ? '▲' : '▼'}</div>
                      </div>
                    </div>
                    {!expanded && (
                      <div style={{ marginTop: 4, fontSize: 11, color: hasMine ? '#34D399' : '#EF4444', fontWeight: hasMine ? 400 : 600 }}>
                        {hasMine ? `Tvůj tip: ${myTip.home} : ${myTip.away}` : '⚠ Ještě jsi netipoval/a'}
                      </div>
                    )}
                  </div>

                  {expanded && (
                    <div style={{ borderTop: '1px solid #1E293B', paddingTop: 12, marginTop: 10 }}>
                      <div style={{ fontSize: 10, color: '#334155', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10 }}>
                        Tip — Česko : {match.opponent}
                      </div>
                      {members.map(m => {
                        const tip = getTip(match.id, m.name);
                        const isMe = m.name === me;
                        const hasTip = tip.home != null && tip.home !== '';
                        return (
                          <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                            <Avatar member={m} size={28} ring={isMe} />
                            <div style={{ width: 56, fontSize: 11, color: isMe ? '#F1F5F9' : '#475569', fontWeight: isMe ? 700 : 400, flexShrink: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.name}</div>
                            <ScoreInput
                              value={tip.home ?? ''}
                              onChange={v => saveTip(match.id, m.name, v, tip.away ?? '')}
                              placeholder="CZE"
                              highlight={isMe}
                            />
                            <span style={{ color: '#334155', fontWeight: 700, fontSize: 18 }}>:</span>
                            <ScoreInput
                              value={tip.away ?? ''}
                              onChange={v => saveTip(match.id, m.name, tip.home ?? '', v)}
                              placeholder="OPP"
                              highlight={isMe}
                            />
                            {hasTip && <span style={{ fontSize: 12, color: '#FFD60A' }}>✓</span>}
                          </div>
                        );
                      })}

                      {isAdmin && (
                        <div style={{ borderTop: '1px solid #1E293B', paddingTop: 10, marginTop: 8 }}>
                          <div style={{ fontSize: 10, color: '#EF4444', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>Admin: zadat výsledek</div>
                          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                            <ScoreInput value={(resultInput[match.id] || {}).home || ''} onChange={v => setResultInput(r => ({ ...r, [match.id]: { ...(r[match.id] || {}), home: v } }))} placeholder="CZE" />
                            <span style={{ color: '#334155', fontWeight: 700, fontSize: 20 }}>:</span>
                            <ScoreInput value={(resultInput[match.id] || {}).away || ''} onChange={v => setResultInput(r => ({ ...r, [match.id]: { ...(r[match.id] || {}), away: v } }))} placeholder="OPP" />
                            <button onClick={() => setResult(match.id, resultInput[match.id]?.home, resultInput[match.id]?.away)} className="tap" style={{ ...btn('#EF4444', '#fff'), flex: 1 }}>Potvrdit ✓</button>
                            <button onClick={() => deleteMatch(match.id)} className="tap" style={{ ...btn('#3F1010', '#EF4444'), padding: '9px 12px', fontSize: 16 }}>🗑</button>
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
                <div style={{ fontSize: 10, color: '#334155', textTransform: 'uppercase', letterSpacing: 1, margin: '16px 0 8px' }}>
                  Odehrané zápasy ({finishedMatches.length})
                </div>
                {finishedMatches.map(match => {
                  const rd = hist.find(h => h.matchId === match.id);
                  const isEd = editingResult === match.id;
                  const matchTips = tips.filter(t => t.match_id === match.id);
                  const result = { home: String(match.result_home), away: String(match.result_away) };
                  return (
                    <div key={match.id} style={{ ...card, marginBottom: 10, background: '#080D16' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                        <div>
                          <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 18, letterSpacing: 1.5, color: '#475569' }}>
                            🇨🇿 <span style={{ color: '#FFD60A' }}>{match.result_home}:{match.result_away}</span> {match.opponent.toUpperCase()}
                          </div>
                          <div style={{ fontSize: 10, color: '#1E293B', marginTop: 2 }}>{match.phase} · {match.match_date}</div>
                        </div>
                        <div style={{ display: 'flex', gap: 5, alignItems: 'center', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                          {rd?.winner && <div style={{ fontSize: 11, color: '#FFD60A', fontWeight: 700 }}>🏆 {rd.winner} +{rd.bank}🍺</div>}
                          {!rd?.winner && rd && <div style={{ fontSize: 10, color: '#FFD60A' }}>🔄 jackpot</div>}
                          {match.status === 'finished' && (
                            <button onClick={() => setShowWA(match.id)} className="tap" style={{ ...smBtn('#25D366'), border: '1px solid #25D36633', fontSize: 16, padding: '4px 8px' }}>💬</button>
                          )}
                          {isAdmin && <>
                            <button onClick={() => setEditingResult(isEd ? null : match.id)} className="tap" style={{ ...smBtn('#FFD60A'), border: '1px solid #FFD60A33' }}>✏</button>
                            <button onClick={() => reopenMatch(match.id)} className="tap" style={{ ...smBtn('#60A5FA'), border: '1px solid #3B82F633' }}>↩</button>
                          </>}
                        </div>
                      </div>

                      {isAdmin && isEd && (
                        <div style={{ background: '#1E293B', borderRadius: 8, padding: '10px 12px', marginBottom: 10, border: '1px solid #FFD60A33', animation: 'fadeUp 0.15s ease' }}>
                          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                            <ScoreInput value={(resultInput[match.id] || {}).home ?? String(match.result_home)} onChange={v => setResultInput(r => ({ ...r, [match.id]: { ...(r[match.id] || {}), home: v } }))} placeholder="CZE" />
                            <span style={{ color: '#334155', fontWeight: 700, fontSize: 20 }}>:</span>
                            <ScoreInput value={(resultInput[match.id] || {}).away ?? String(match.result_away)} onChange={v => setResultInput(r => ({ ...r, [match.id]: { ...(r[match.id] || {}), away: v } }))} placeholder="OPP" />
                            <button onClick={() => setResult(match.id, resultInput[match.id]?.home ?? match.result_home, resultInput[match.id]?.away ?? match.result_away)} className="tap" style={{ ...btn('#EF4444', '#fff'), flex: 1 }}>Uložit ✓</button>
                          </div>
                        </div>
                      )}

                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                        {members.map(m => {
                          const tip = matchTips.find(t => t.member_name === m.name);
                          if (!tip || tip.home == null) return (
                            <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'rgba(255,255,255,0.02)', border: '1px solid #1E293B', borderRadius: 8, padding: '4px 8px' }}>
                              <Avatar member={m} size={16} />
                              <span style={{ fontSize: 10, color: '#1E293B' }}>{m.name} —</span>
                            </div>
                          );
                          const pts = calcPts({ home: String(tip.home), away: String(tip.away) }, result);
                          const pl = ptLabel(pts);
                          const isW = m.name === rd?.winner;
                          return (
                            <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: 5, background: isW ? '#FFD60A08' : `${pl.c}08`, border: `1px solid ${isW ? '#FFD60A' : pl.c + '33'}`, borderRadius: 8, padding: '4px 9px' }}>
                              <Avatar member={m} size={18} />
                              <span style={{ fontSize: 10, color: isW ? '#FFD60A' : '#64748B', fontWeight: isW ? 700 : 400 }}>{isW ? '🏆 ' : ''}{m.name}</span>
                              <b style={{ fontSize: 11, color: '#F1F5F9' }}>{tip.home}:{tip.away}</b>
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

            {matches.length === 0 && (
              <div style={{ textAlign: 'center', padding: 50, color: '#1E293B' }}>
                <div style={{ fontSize: 40, marginBottom: 8 }}>🏒</div>
                <div style={{ fontSize: 13, color: '#334155' }}>{isAdmin ? 'Přidej první zápas!' : 'Žádné zápasy — čekej na admina.'}</div>
              </div>
            )}
          </>
        )}

        {/* ══ TABULKA ══ */}
        {tab === 'tabulka' && (
          <>
            <div style={{ ...card, marginBottom: 12 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#334155', textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 10 }}>Bodování</div>
              {[['🎯 Přesný výsledek','10 b','#FFD60A'],['🥈 Vítěz + rozdíl gólů','6 b','#34D399'],['✅ Správný vítěz','4 b','#60A5FA'],['🟡 Počet NEBO rozdíl gólů','2 b','#FB923C'],['❌ Nic','0 b','#F87171']].map(([l,p,c]) => (
                <div key={l} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 4 }}>
                  <span style={{ color: '#475569' }}>{l}</span>
                  <span style={{ color: c, fontWeight: 700 }}>{p}</span>
                </div>
              ))}
              <div style={{ marginTop: 8, paddingTop: 8, borderTop: '1px solid #1E293B', fontSize: 10, color: '#1E293B' }}>
                ⚠ Každý tip v zápase musí být unikátní.
              </div>
            </div>

            {ranked.map((m, i) => {
              const s = stats[m.name] || { beers: 0, pts: 0, att: 0, exact: 0 };
              const pct = s.att > 0 ? Math.round(s.pts / (s.att * 10) * 100) : 0;
              const col = memberColor(m.name);
              return (
                <div key={m.id} style={{ ...card, marginBottom: 9, background: i === 0 ? `linear-gradient(135deg,${col}08,#0F172A)` : '#0F172A', border: `1px solid ${i === 0 ? col + '55' : '#1E293B'}` }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ fontSize: 22, width: 30, textAlign: 'center' }}>{['🥇','🥈','🥉'][i] || `${i+1}.`}</div>
                    <Avatar member={m} size={44} ring={i === 0} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 15, fontWeight: 700, color: i === 0 ? '#FFD60A' : '#F1F5F9' }}>{m.name}</div>
                      <div style={{ fontSize: 10, color: '#334155', marginTop: 1 }}>{s.att} tipů · {s.pts}b · {s.exact}× přesný · {pct}%</div>
                      <div style={{ marginTop: 5, display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                        {Array.from({ length: Math.min(s.beers, 20) }).map((_, j) => <span key={j} style={{ fontSize: 14 }}>🍺</span>)}
                        {s.beers > 20 && <span style={{ fontSize: 10, color: '#FFD60A', alignSelf: 'center' }}>+{s.beers - 20}</span>}
                        {s.beers === 0 && <span style={{ fontSize: 10, color: '#1E293B' }}>Žádné plzničky</span>}
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 34, color: '#EF4444', lineHeight: 1 }}>{s.beers}</div>
                      <div style={{ fontSize: 9, color: '#334155' }}>🍺</div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: '#334155' }}>{s.pts}b</div>
                    </div>
                  </div>
                </div>
              );
            })}

            {finishedMatches.length > 0 && ranked.length > 0 && (() => {
              const bk = ranked[0].name;
              const pk = [...members].sort((a, b) => (stats[b.name]?.pts || 0) - (stats[a.name]?.pts || 0))[0]?.name;
              return (
                <div style={{ ...card, background: 'linear-gradient(135deg,#1A0A0A,#0F172A)', border: '1px solid #EF444433', marginTop: 8 }}>
                  <div style={{ fontSize: 15, fontWeight: 700, color: '#EF4444', marginBottom: 12 }}>🏆 ULTIMATE WINNER</div>
                  {[[`🍺 Král Plzničky:`, bk, `${stats[bk]?.beers || 0} plzniček`], [`🎯 Nejlepší tipér:`, pk, `${stats[pk]?.pts || 0} bodů`]].map(([label, name, val]) => {
                    const mo = members.find(m => m.name === name);
                    return (
                      <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                        <Avatar member={mo || { name }} size={36} ring />
                        <div style={{ fontSize: 13 }}>{label} <span style={{ color: '#FFD60A', fontWeight: 700 }}>{name}</span> <span style={{ color: '#334155' }}>({val})</span></div>
                      </div>
                    );
                  })}
                  {bk === pk && <div style={{ marginTop: 8, color: '#FFD60A', fontWeight: 700 }}>🎉 DOUBLE WINNER — {bk} ovládl vše!</div>}
                </div>
              );
            })()}
          </>
        )}

        {/* ══ BANKA ══ */}
        {tab === 'banka' && (
          <>
            {carry > 0 && (
              <div style={{ ...card, background: 'linear-gradient(135deg,#1A1200,#0F172A)', border: '1px solid #FFD60A55', marginBottom: 12, display: 'flex', gap: 12, alignItems: 'center' }}>
                <span style={{ fontSize: 36 }}>🍺</span>
                <div>
                  <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 22, color: '#FFD60A', letterSpacing: 2 }}>JACKPOT: {carry} Plzniček!</div>
                  <div style={{ fontSize: 11, color: '#92400E' }}>Remíza — přechází do dalšího kola</div>
                </div>
              </div>
            )}
            {hist.length === 0 && <div style={{ textAlign: 'center', padding: 50 }}><div style={{ fontSize: 36 }}>🍺</div><div style={{ color: '#334155', marginTop: 8 }}>Žádné odehrané zápasy.</div></div>}
            {hist.map(r => {
              const match = matches.find(m => m.id === r.matchId);
              if (!match) return null;
              const matchTips = tips.filter(t => t.match_id === match.id);
              return (
                <div key={r.matchId} style={{ ...card, marginBottom: 10, border: `1px solid ${r.winner ? '#EF444433' : '#FFD60A22'}` }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                    <div>
                      <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 17, letterSpacing: 1.5, color: '#475569' }}>
                        🇨🇿 <span style={{ color: '#FFD60A' }}>{match.result_home}:{match.result_away}</span> {match.opponent.toUpperCase()}
                      </div>
                      <div style={{ fontSize: 10, color: '#1E293B' }}>{match.match_date} · {match.phase}</div>
                    </div>
                    <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 24, color: '#FFD60A' }}>{r.bank}🍺</div>
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginBottom: 8 }}>
                    {r.scored.map(({ name, p }) => {
                      const pl = ptLabel(p);
                      const isW = name === r.winner;
                      const mo = members.find(m => m.name === name) || { name };
                      const tip = matchTips.find(t => t.member_name === name);
                      return (
                        <div key={name} style={{ display: 'flex', alignItems: 'center', gap: 5, background: isW ? '#FFD60A08' : `${pl.c}08`, border: `1px solid ${isW ? '#FFD60A' : pl.c + '33'}`, borderRadius: 8, padding: '4px 9px' }}>
                          <Avatar member={mo} size={18} />
                          <span style={{ fontSize: 10, color: isW ? '#FFD60A' : '#64748B', fontWeight: isW ? 700 : 400 }}>{isW ? '🏆 ' : ''}{name}</span>
                          {tip && <b style={{ fontSize: 11, color: '#F1F5F9' }}>{tip.home}:{tip.away}</b>}
                          <span style={{ fontSize: 11, color: pl.c }}>{pl.e}{p}b</span>
                        </div>
                      );
                    })}
                  </div>
                  {r.winner
                    ? <div style={{ background: '#FFD60A08', border: '1px solid #FFD60A33', borderRadius: 8, padding: '7px 12px', fontSize: 12, color: '#FFD60A', fontWeight: 700 }}>🏆 {r.winner} bere {r.bank} Plzniček!</div>
                    : <div style={{ background: '#1A1200', border: '1px solid #FFD60A22', borderRadius: 8, padding: '7px 12px', fontSize: 11, color: '#92400E' }}>🔄 Remíza — přechází dál</div>
                  }
                </div>
              );
            })}
          </>
        )}

        {/* ══ VYROVNÁNÍ ══ */}
        {tab === 'vyrovnani' && (
          <>
            {tx.length === 0 && <div style={{ textAlign: 'center', padding: 50 }}><div style={{ fontSize: 40 }}>{finishedMatches.length === 0 ? '⏳' : '🤝'}</div><div style={{ color: '#334155', marginTop: 8, fontSize: 13 }}>{finishedMatches.length === 0 ? 'Zatím žádné výsledky.' : 'Všichni vyrovnaní!'}</div></div>}
            {tx.map((t, i) => {
              const fromM = members.find(m => m.name === t.from) || { name: t.from };
              const toM = members.find(m => m.name === t.to) || { name: t.to };
              return (
                <div key={i} style={{ ...card, marginBottom: 10, display: 'flex', alignItems: 'center', gap: 12, border: '1px solid #EF444422' }}>
                  <div style={{ flex: 1, textAlign: 'center' }}>
                    <Avatar member={fromM} size={44} />
                    <div style={{ fontSize: 14, fontWeight: 700, color: '#EF4444', marginTop: 4 }}>{t.from}</div>
                    <div style={{ fontSize: 10, color: '#334155' }}>kupuje</div>
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 28, color: '#FFD60A' }}>{t.b}×🍺</div>
                    <div style={{ fontSize: 22, color: '#334155' }}>→</div>
                  </div>
                  <div style={{ flex: 1, textAlign: 'center' }}>
                    <Avatar member={toM} size={44} />
                    <div style={{ fontSize: 14, fontWeight: 700, color: '#34D399', marginTop: 4 }}>{t.to}</div>
                    <div style={{ fontSize: 10, color: '#334155' }}>dostane</div>
                  </div>
                </div>
              );
            })}
            {finishedMatches.length > 0 && members.length > 0 && (
              <div style={{ marginTop: 14 }}>
                <div style={{ fontSize: 10, color: '#334155', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>Čistá bilance</div>
                {members.map(m => {
                  const v = net[m.name] || 0;
                  return (
                    <div key={m.id} style={{ ...card, marginBottom: 6, padding: '9px 14px', display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'space-between', background: '#080D16' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <Avatar member={m} size={28} />
                        <span style={{ fontSize: 13, fontWeight: 600 }}>{m.name}</span>
                      </div>
                      <span style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 20, color: v > 0 ? '#34D399' : v < 0 ? '#EF4444' : '#334155' }}>
                        {v > 0 ? `+${v} 🍺` : v < 0 ? `${v} 🍺` : '±0'}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}

        {/* ══ ARCHIV ══ */}
        {tab === 'archiv' && (
          <>
            {seasons.map(s => {
              const isCur = s.id === activeSeason.id;
              return (
                <div key={s.id} style={{ ...card, marginBottom: 10, border: `1px solid ${isCur ? '#3B82F666' : '#1E293B'}`, background: isCur ? '#0F1F33' : '#0F172A' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                    <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 22, letterSpacing: 2, color: isCur ? '#3B82F6' : '#334155' }}>
                      MS {s.year} {isCur && '← nyní'}
                    </div>
                    {!isCur && <button onClick={() => switchSeason(s.id)} className="tap" style={{ ...smBtn('#60A5FA'), border: '1px solid #3B82F633' }}>Přepnout</button>}
                  </div>
                  <div style={{ fontSize: 11, color: '#334155' }}>{s.app_name}</div>
                </div>
              );
            })}
          </>
        )}
      </div>
    </>
  );
}
