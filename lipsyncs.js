// =========================
// Lip-sync song pool
// =========================

window.LIPSYNC_SONGS = [
  "Edge of Seventeen — Stevie Nicks",
  "Physical — Dua Lipa",
  "I Will Survive — Gloria Gaynor",
  "Hung Up — Madonna",
  "Since U Been Gone — Kelly Clarkson",
  "Believe — Cher",
  "Don’t Start Now — Dua Lipa",
  "Into You — Ariana Grande",
  "Respect — Aretha Franklin",
  "Bad Romance — Lady Gaga"
];

// Pick a song without repeating until pool is exhausted
window.pickLipSyncSong = function (usedSet) {
  const used = usedSet instanceof Set ? usedSet : new Set();
  const available = window.LIPSYNC_SONGS.filter(s => !used.has(s));
  const pool = available.length ? available : window.LIPSYNC_SONGS;
  const song = pool[Math.floor(Math.random() * pool.length)];
  used.add(song);
  return song;
};
