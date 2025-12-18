// =========================
// Lip-sync song pool
// =========================

window.LIPSYNC_SONGS = [
  "Edge of Seventeen by Stevie Nicks",
  "Physical by Dua Lipa",
  "I Will Survive by Gloria Gaynor",
  "Hung Up by Madonna",
  "Since U Been Gone by Kelly Clarkson",
  "Believe by Cher",
  "Don’t Start Now by Dua Lipa",
  "Into You by Ariana Grande",
  "Respect by Aretha Franklin",
  "Bad Romance by Lady Gaga"
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
