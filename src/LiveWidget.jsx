import React, { useState, useEffect, useCallback, useRef } from 'react';
import { calcPts, ptLabel } from './logic';
import { Avatar } from './components';

const IIHF_LEAGUE = 10;
const IIHF_SEASON = 2026;

export default function LiveWidget({ match, tips, members, apiKey, isAdmin, onSaveResult }) {
  const [live, setLive] = useState(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState(null);
  const [saved, setSaved] = useState(false);
  const timer = useRef(null);

  const fetchLive = useCallback(async () => {
    if (!apiKey || !match) return;
    setLoading(true); setErr(null);
    try {
      const today = new Date().toISOString().slice(0, 10);
      const res = await fetch(
        `https://v1.hockey.api-sports.io/games?league=${IIHF_LEAGUE}&season=${IIHF_SEASON}&date=${today}`,
        { headers: { 'x-apisports-key': apiKey } }
      );
      const data = await res.json();
      if (data.errors && Object.keys(data.errors).length) {
        setErr('API chyba — zkontroluj klíč'); setLoading(false); return;
      }
      const game = (data.response || []).find(g => {
        const h = (g.teams?.home?.name || '').toLowerCase();
        const a = (g.teams?.away?.name || '').toLowerCase();
        return h.includes('czech') || a.includes('czech');
      });
      if (game) {
        const czIsHome = game.teams.home.name.toLowerCase().includes('czech');
        setLive({
          homeScore: czIsHome ? game.scores?.home : game.scores?.away,
          awayScore: czIsHome ? game.scores?.away : game.scores?.home,
          status: game.status?.long || '',
          statusShort: game.status?.short || '',
          period: game.periods?.current,
          time: game.status?.timer,
          finished: ['FT','AOT','AP','AET','Finished','After OT','After SO'].includes(game.status?.short || ''),
        });
        setSaved(false);
      } else {
        setLive(null);
        setErr('Dnes žádný zápas Česka v API');
      }
    } catch (e) { setErr('Chyba připojení: ' + e.message); }
    setLoading(false);
  }, [apiKey, match]);

  useEffect(() => {
    if (!apiKey || !match) return;
    fetchLive();
    timer.current = setInterval(fetchLive, 60000);
    return () => clearInterval(timer.current);
  }, [fetchLive, apiKey, match]);

  // Reset saved flag when match changes
  useEffect(() => { setSaved(false); }, [match?.id]);

  if (!match) return (
    <div style={widgetBase}>
      <div style={{ textAlign: 'center', color: '#334155', padding: '20px 0', fontSize: 13 }}>
        🏒 Žádný nadcházející zápas
      </div>
    </div>
  );

  const result = live?.homeScore != null
    ? { home: String(live.homeScore), away: String(live.awayScore) }
    : null;

  const matchTips = tips.filter(t => t.match_id === match.id);
  const ranking = result
    ? matchTips
        .filter(t => t.home != null)
        .map(t => ({ t, member: members.find(m => m.name === t.member_name) || { name: t.member_name }, p: calcPts({ home: String(t.home), away: String(t.away) }, result) }))
        .sort((a, b) => b.p - a.p)
    : [];

  const canSave = isAdmin && result && live?.finished && !saved;

  return (
    <div style={widgetBase}>
      {/* Glow */}
      <div style={{ position: 'absolute', top: -40, right: -40, width: 160, height: 160, background: 'radial-gradient(circle,#3B82F618,transparent 70%)', borderRadius: '50%', pointerEvents: 'none' }} />

      {/* Status row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 12 }}>
        <div style={{
          width: 8, height: 8, borderRadius: '50%',
          background: live?.finished ? '#34D399' : result ? '#EF4444' : '#475569',
          animation: result && !live?.finished ? 'livePulse 1.2s ease-in-out infinite' : 'none',
        }} />
        <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: 2, textTransform: 'uppercase', color: live?.finished ? '#34D399' : result ? '#EF4444' : '#475569' }}>
          {live?.finished ? 'Konec zápasu' : result ? (live?.status || 'Live') : apiKey ? (loading ? 'Načítám…' : 'Čekám na zápas') : 'Nadcházející zápas'}
        </span>
        {live?.period && !live.finished && (
          <span style={{ fontSize: 10, color: '#475569' }}>· {live.period}. třetina{live.time ? ` ${live.time}′` : ''}</span>
        )}
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 5 }}>
          {!apiKey && <span style={{ fontSize: 9, color: '#334155' }}>bez API klíče</span>}
          {apiKey && <button onClick={fetchLive} style={{ background: 'none', border: 'none', color: '#334155', cursor: 'pointer', fontSize: 15 }}>⟳</button>}
        </div>
      </div>

      {err && <div style={{ fontSize: 11, color: '#F87171', marginBottom: 8 }}>{err}</div>}

      {/* Scoreboard */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: canSave || ranking.length > 0 ? 14 : 0 }}>
        <div style={{ textAlign: 'center', flex: 1 }}>
          <div style={{ fontSize: 32, marginBottom: 4 }}>🇨🇿</div>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#F1F5F9' }}>Česko</div>
        </div>
        <div style={{ textAlign: 'center', padding: '0 12px' }}>
          {result
            ? <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 48, lineHeight: 1, letterSpacing: 3 }}>
                <span style={{ color: +result.home > +result.away ? '#34D399' : +result.home < +result.away ? '#F87171' : '#F1F5F9' }}>{result.home}</span>
                <span style={{ color: '#334155', fontSize: 36, margin: '0 4px' }}>:</span>
                <span style={{ color: +result.away > +result.home ? '#34D399' : +result.away < +result.home ? '#F87171' : '#F1F5F9' }}>{result.away}</span>
              </div>
            : <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 40, color: '#1E293B', letterSpacing: 4 }}>– : –</div>
          }
          <div style={{ fontSize: 9, color: '#334155', textTransform: 'uppercase', letterSpacing: 2, marginTop: 2 }}>{match.phase}</div>
        </div>
        <div style={{ textAlign: 'center', flex: 1 }}>
          <div style={{ fontSize: 32, marginBottom: 4 }}>🏒</div>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#64748B' }}>{match.opponent}</div>
        </div>
      </div>

      {/* Save button */}
      {canSave && (
        <button
          onClick={() => { onSaveResult(result); setSaved(true); }}
          style={{ width: '100%', marginBottom: 12, background: 'linear-gradient(90deg,#16A34A,#15803D)', border: 'none', borderRadius: 10, padding: 12, color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
        >
          ✅ Uložit výsledek {result.home}:{result.away} do tipovačky
        </button>
      )}
      {saved && <div style={{ textAlign: 'center', fontSize: 12, color: '#34D399', fontWeight: 600, marginBottom: 12 }}>✓ Výsledek uložen!</div>}

      {/* Tip ranking */}
      {ranking.length > 0 && (
        <>
          <div style={{ fontSize: 10, color: '#334155', textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 8 }}>
            {live?.finished ? 'Výsledné pořadí' : 'Aktuální pořadí tipů'}
          </div>
          {ranking.map(({ t, member, p }, i) => {
            const pl = ptLabel(p);
            return (
              <div key={t.member_name} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 5, background: i === 0 ? '#FFD60A0A' : 'rgba(255,255,255,0.02)', borderRadius: 8, padding: '6px 10px', border: i === 0 ? '1px solid #FFD60A33' : '1px solid transparent' }}>
                <span style={{ width: 20, textAlign: 'center', fontSize: 14 }}>{['🥇','🥈','🥉'][i] || `${i+1}.`}</span>
                <Avatar member={member} size={26} />
                <div style={{ flex: 1, fontSize: 12, fontWeight: i === 0 ? 700 : 400, color: '#F1F5F9' }}>{t.member_name}</div>
                <div style={{ fontSize: 12, color: '#475569' }}>tip: <b style={{ color: '#F1F5F9' }}>{t.home}:{t.away}</b></div>
                <div style={{ fontSize: 12, fontWeight: 700, color: pl.c }}>{p}b {pl.e}</div>
              </div>
            );
          })}
        </>
      )}

      {!result && ranking.length === 0 && (
        <div style={{ textAlign: 'center', fontSize: 12, color: '#1E293B', padding: '6px 0' }}>
          {apiKey ? 'Čekám na start zápasu…' : 'Přidej API klíč pro automatické live skóre'}
        </div>
      )}
    </div>
  );
}

const widgetBase = {
  background: 'linear-gradient(135deg,#0F172A,#1E293B)',
  border: '1px solid #334155', borderRadius: 16,
  padding: '16px 14px', marginBottom: 14, position: 'relative', overflow: 'hidden',
};
