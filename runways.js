// runways.js
// A simple runway-category pool used by sim.js.
// sim.js will avoid repeats until the pool is exhausted.

window.RUNWAY_CATEGORIES = [
  "Latex",
  "Night of 1,000 Divas",
  "Black & White Ball",
  "Red Carpet Realness",
  "Futuristic Fashion",
  "Denim on Denim",
  "Animal Print Extravaganza",
  "Feathers & Fringe",
  "All That Glitters",
  "Monochrome Madness",
  "Neon Nights",
  "Leather & Lace",
  "Circus Couture",
  "Campy Cartoon",
  "Goth Glamour",
  "Old Hollywood",
  "Business in the Front, Party in the Back",
  "Fairy Tale Fantasy",
  "Pastel Princess",
  "Knitwear Eleganza",
  "Plaid to the Bone",
  "Floral Fantasy",
  "Avant-Garde Art Piece",
  "High Fashion Streetwear",
  "Metallic Mayhem",
  "Two Looks in One",
  "Country Couture",
  "Celestial Bodies",
  "The Colors of the Rainbow"
];

// Optional helper if you want to pick categories outside sim.js.
window.pickUniqueRunwayCategory = function pickUniqueRunwayCategory(usedSet, forceCategory) {
  if (forceCategory) return forceCategory;
  const cats = Array.isArray(window.RUNWAY_CATEGORIES) ? window.RUNWAY_CATEGORIES : [];
  if (!cats.length) return null;

  const used = usedSet instanceof Set ? usedSet : new Set();
  const available = cats.filter(c => !used.has(c));
  const pool = available.length ? available : cats;
  const chosen = pool[Math.floor(Math.random() * pool.length)];
  used.add(chosen);
  return chosen;
};
