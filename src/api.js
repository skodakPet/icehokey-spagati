async function request(url, options = {}) {
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.error || `HTTP ${res.status}`);
    err.status = res.status;
    err.code = data.code;
    throw err;
  }
  return data;
}

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = reject;
    r.readAsDataURL(file);
  });
}

export const api = {
  getState: (seasonId) => request(`/api/state${seasonId ? `?seasonId=${seasonId}` : ''}`),

  addMatch: (payload) => request('/api/matches', { method: 'POST', body: JSON.stringify(payload) }),
  deleteMatch: (id) => request(`/api/matches?id=${id}`, { method: 'DELETE' }),
  finishMatch: (id, result_home, result_away) =>
    request(`/api/matches?id=${id}`, { method: 'PATCH', body: JSON.stringify({ action: 'finish', result_home, result_away }) }),
  reopenMatch: (id) =>
    request(`/api/matches?id=${id}`, { method: 'PATCH', body: JSON.stringify({ action: 'reopen' }) }),

  upsertTip: (payload) => request('/api/tips', { method: 'POST', body: JSON.stringify(payload) }),

  addMember: (season_id, name) => request('/api/members', { method: 'POST', body: JSON.stringify({ season_id, name }) }),
  deleteMember: (id) => request(`/api/members?id=${id}`, { method: 'DELETE' }),
  setMemberPhoto: (id, photo_url) =>
    request(`/api/members?id=${id}`, { method: 'PATCH', body: JSON.stringify({ photo_url }) }),

  uploadPhoto: async (file) => {
    const dataUrl = await fileToDataUrl(file);
    return request('/api/upload-photo', {
      method: 'POST',
      body: JSON.stringify({ filename: file.name, dataUrl }),
    });
  },

  addSeason: (year, copyMembersFromSeasonId) =>
    request('/api/seasons', { method: 'POST', body: JSON.stringify({ year, copyMembersFromSeasonId }) }),
  setActiveSeason: (active_season_id) =>
    request('/api/seasons', { method: 'PATCH', body: JSON.stringify({ active_season_id }) }),

  updateSettings: (payload) => request('/api/settings', { method: 'PATCH', body: JSON.stringify(payload) }),
};
