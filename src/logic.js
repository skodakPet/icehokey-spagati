// ── BODOVÁNÍ ──────────────────────────────────────────────────────────────────
// 10 = přesný výsledek
//  6 = správný vítěz + správný rozdíl gólů
//  4 = správný vítěz
//  2 = správný počet gólů NEBO stejný rozdíl
//  0 = nic
// Každý tip musí být unikátní v rámci zápasu.

export function calcPts(tip, result) {
  if (!tip || !result) return null;
  const [th, ta, rh, ra] = [+tip.home, +tip.away, +result.home, +result.away];
  if ([th, ta, rh, ra].some(isNaN)) return null;
  const td = th - ta, rd = rh - ra;
  const tw = td > 0 ? 'h' : 'a', rw = rd > 0 ? 'h' : 'a';
  if (th === rh && ta === ra) return 10;
  if (tw === rw && td === rd) return 6;
  if (tw === rw) return 4;
  if ((th + ta) === (rh + ra) || Math.abs(td) === Math.abs(rd)) return 2;
  return 0;
}

export function ptLabel(p) {
  if (p === 10) return { t: 'Přesný tip!',     c: '#FFD60A', e: '🎯' };
  if (p === 6)  return { t: 'Vítěz + rozdíl',  c: '#34D399', e: '🥈' };
  if (p === 4)  return { t: 'Správný vítěz',   c: '#60A5FA', e: '✅' };
  if (p === 2)  return { t: 'Počet/rozdíl',    c: '#FB923C', e: '🟡' };
  return              { t: 'Žádné body',        c: '#F87171', e: '❌' };
}

// ── BANKA PIVO ────────────────────────────────────────────────────────────────
export function bankHistory(matches, tips, members) {
  let carry = 0;
  const hist = [];
  const sorted = [...matches].sort((a, b) =>
    new Date(a.match_date) - new Date(b.match_date)
  );
  for (const m of sorted) {
    if (m.status !== 'finished' || m.result_home == null) continue;
    const result = { home: String(m.result_home), away: String(m.result_away) };
    const mt = tips.filter(t => t.match_id === m.id);
    const tippers = mt.filter(t => t.home != null && t.away != null);
    const bank = tippers.length + carry;
    const scored = tippers.map(t => ({ name: t.member_name, p: calcPts({ home: String(t.home), away: String(t.away) }, result) }));
    const max = scored.length ? Math.max(...scored.map(x => x.p)) : 0;
    const winners = scored.filter(x => x.p === max && x.p > 0);
    const winner = winners.length === 1 ? winners[0].name : null;
    carry = winner ? 0 : bank;
    hist.push({ matchId: m.id, bank, scored, winner, carry: winner ? 0 : bank });
  }
  return { hist, carry };
}

export function overallStats(matches, tips, members, hist) {
  const s = {};
  members.forEach(m => { s[m.name] = { beers: 0, pts: 0, att: 0, exact: 0 }; });
  for (const m of matches) {
    if (m.status !== 'finished' || m.result_home == null) continue;
    const result = { home: String(m.result_home), away: String(m.result_away) };
    const mt = tips.filter(t => t.match_id === m.id && t.home != null);
    for (const t of mt) {
      if (!s[t.member_name]) s[t.member_name] = { beers: 0, pts: 0, att: 0, exact: 0 };
      const p = calcPts({ home: String(t.home), away: String(t.away) }, result);
      if (p === null) continue;
      s[t.member_name].att++;
      s[t.member_name].pts += p;
      if (p === 10) s[t.member_name].exact++;
    }
  }
  for (const r of hist) {
    if (r.winner && s[r.winner]) s[r.winner].beers += r.bank;
  }
  return s;
}

export function settlement(members, hist) {
  const net = {};
  members.forEach(m => { net[m.name] = 0; });
  for (const r of hist) {
    if (!r.winner) continue;
    r.scored.forEach(({ name }) => {
      if (!net[name]) net[name] = 0;
      if (name !== r.winner) net[name]--;
    });
    if (!net[r.winner]) net[r.winner] = 0;
    net[r.winner] += r.scored.length - 1;
  }
  const cred = members.filter(m => net[m.name] > 0).map(m => ({ n: m.name, v: net[m.name] }));
  const debt = members.filter(m => net[m.name] < 0).map(m => ({ n: m.name, v: -net[m.name] }));
  const tx = [];
  let ci = 0, di = 0;
  while (ci < cred.length && di < debt.length) {
    const g = Math.min(cred[ci].v, debt[di].v);
    tx.push({ from: debt[di].n, to: cred[ci].n, b: g });
    cred[ci].v -= g; debt[di].v -= g;
    if (!cred[ci].v) ci++;
    if (!debt[di].v) di++;
  }
  return { net, tx };
}

// ── WA MESSAGE ────────────────────────────────────────────────────────────────
export function buildWA(match, tips, members, hist, comment, appName) {
  const rd = hist.find(h => h.matchId === match.id);
  const mt = tips.filter(t => t.match_id === match.id);
  let msg = `🏒 *${appName || 'Tipovačka o Plzničku'}*\n`;
  msg += `🇨🇿 Česko *${match.result_home}:${match.result_away}* ${match.opponent}\n`;
  msg += `📅 ${match.match_date} · ${match.phase}\n\n`;
  msg += `📊 *Výsledky tipů:*\n`;
  const rows = mt
    .map(t => {
      if (t.home == null) return null;
      const p = calcPts({ home: String(t.home), away: String(t.away) }, { home: String(match.result_home), away: String(match.result_away) });
      return { name: t.member_name, t, p, pl: ptLabel(p) };
    })
    .filter(Boolean)
    .sort((a, b) => b.p - a.p);
  rows.forEach(r => { msg += `${r.pl.e} *${r.name}*: ${r.t.home}:${r.t.away} → ${r.p} bodů\n`; });
  msg += '\n';
  if (rd?.winner) msg += `🏆 *Vítěz kola: ${rd.winner}* bere ${rd.bank} 🍺!\n`;
  else if (rd) msg += `🔄 *Remíza!* ${rd.bank} 🍺 přechází dál\n`;
  if (comment) msg += `\n💬 ${comment}\n`;
  msg += `\n🍺 _${appName || 'Tipovačka o Plzničku'}_`;
  return msg;
}

// ── COLORS ────────────────────────────────────────────────────────────────────
export const MEMBER_COLORS = ['#EF4444','#3B82F6','#10B981','#F59E0B','#8B5CF6','#EC4899','#14B8A6','#F97316'];
export const memberColor = name => MEMBER_COLORS[(name || '').charCodeAt(0) % MEMBER_COLORS.length];
