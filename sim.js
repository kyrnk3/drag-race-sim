// sim.js

// =========================
// Config / Chaos toggles
// =========================

// Default behavior if options.mode isn't provided.
const CONFIG = {
  CHAOS_MODE_DEFAULT: false,
  AUTO_GENERATE_MISSING_STATS: true,
  AUTO_ASSIGN_EDITS_IN_CHAOS: true
};

// All possible edit flags we support.
const ALL_EDIT_FLAGS = [
  "front_runner",
  "late_bloomer",
  "lip_sync_assassin",
  "fan_favorite",
  "villain",
  "robbed",
  "underestimated",
  "messy"
];

const STAT_NAMES = ["runway", "comedy", "acting", "dance", "singing", "improv"];

// Main challenges from challenges.js
const CHALLENGES = window.CHALLENGES || [];

// Mini-challenges from mini-challenges.js
const MINI_CHALLENGES = window.MINI_CHALLENGES || [];

// Will store all queens for SAFE padding logic.
let allQueensGlobal = [];

// =========================
// Helpers: random
// =========================

function randUniform(min, max) {
  return min + Math.random() * (max - min);
}

function randInt(min, maxInclusive) {
  return Math.floor(Math.random() * (maxInclusive - min + 1)) + min;
}

function choice(array) {
  return array[Math.floor(Math.random() * array.length)];
}

// =========================
// Queen class
// =========================

class Queen {
  constructor(name, stats, dramaProne = false, producerFave = false, edits = []) {
    this.name = name;
    this.stats = stats; // {runway, comedy, acting, dance, singing, improv}
    this.drama_prone = dramaProne;
    this.producer_fave = producerFave;
    this.edits = new Set(edits || []);
    this.track_record = []; // ["WIN", "HIGH", "SAFE", "BTM", "ELIM"]
    this.eliminated = false;
  }
}

// =========================
// Random stat / edit helpers
// =========================

function generateRandomEdits(existingEdits) {
  const current = new Set(existingEdits || []);
  const choices = ALL_EDIT_FLAGS.filter(e => !current.has(e));
  if (!choices.length) return Array.from(current);

  // Probabilities: 0, 1, or 2 edits
  const roll = Math.random();
  let num;
  if (roll < 0.3) num = 0;
  else if (roll < 0.8) num = 1;
  else num = 2;

  const newEdits = Array.from(current);
  if (num > 0) {
    const shuffled = [...choices];
    shuffled.sort(() => Math.random() - 0.5);
    newEdits.push(...shuffled.slice(0, num));
  }
  return newEdits;
}

function generateRandomStats(editsSet) {
  // Base random stats 3–9
  const stats = {};
  for (const name of STAT_NAMES) {
    stats[name] = randInt(3, 9);
  }

  // Pick 2 focus stats to bump
  const statsCopy = [...STAT_NAMES];
  statsCopy.sort(() => Math.random() - 0.5);
  const focusStats = statsCopy.slice(0, 2);
  for (const fs of focusStats) {
    stats[fs] = Math.min(10, stats[fs] + 1);
  }

  // Edit-based tweaks
  if (editsSet.has("front_runner")) {
    for (const k of STAT_NAMES) {
      stats[k] = Math.min(10, stats[k] + 1);
    }
  }

  if (editsSet.has("lip_sync_assassin")) {
    stats["dance"] = Math.min(10, stats["dance"] + 2);
    stats["improv"] = Math.min(10, stats["improv"] + 1);
  }

  // late_bloomer handled via timing, not raw stats

  for (const k of STAT_NAMES) {
    stats[k] = Math.max(1, Math.min(10, stats[k]));
  }

  return stats;
}

// =========================
// Build queens from JSON-ish defs
// =========================

function buildQueensFromDefs(queenDefs, options) {
  const chaosMode = options.mode === "chaos" || CONFIG.CHAOS_MODE_DEFAULT;
  const autoGenStats = CONFIG.AUTO_GENERATE_MISSING_STATS;
  const autoAssignEditsInChaos = CONFIG.AUTO_ASSIGN_EDITS_IN_CHAOS;

  const queens = [];

  for (const entry of queenDefs) {
    const name = entry.name;
    const traits = entry.traits || {};
    let editsList = entry.edits || [];

    // If chaos & no edits specified, assign some at random
    if (chaosMode && autoAssignEditsInChaos && (!editsList || editsList.length === 0)) {
      editsList = generateRandomEdits([]);
    }

    const editsSet = new Set(editsList);
    const statsEntry = entry.stats;

    let needRandom = chaosMode || (autoGenStats && !statsEntry);

    if (!needRandom && statsEntry) {
      // If any stat is missing, randomize
      for (const k of STAT_NAMES) {
        if (!(k in statsEntry)) {
          needRandom = true;
          break;
        }
      }
    }

    let stats;
    if (needRandom) {
      stats = generateRandomStats(editsSet);
    } else {
      stats = {};
      for (const k of STAT_NAMES) {
        stats[k] = statsEntry[k];
      }
    }

    let dramaProne = traits.drama_prone;
    if (dramaProne === undefined || dramaProne === null) {
      dramaProne = Math.random() < 0.35;
    }

    let producerFave = traits.producer_fave;
    if (producerFave === undefined || producerFave === null) {
      producerFave = Math.random() < 0.2;
    }

    const queen = new Queen(name, stats, dramaProne, producerFave, Array.from(editsSet));
    queens.push(queen);
  }

  return queens;
}

// =========================
// Challenge scheduling rules
// =========================

const ONE_OFF_CHALLENGES = new Set([
  "ball",
  "makeover",
  "snatch_game",
  "rusical",
  "rumix",
  "roast"
]);

// Mini-challenges: one-off constraints
const MINI_ONE_OFF_CHALLENGES = new Set([
  "photoshoot", // must be first mini-challenge, once per season
  "reading",    // mid-season, once per season
  "puppets"     // top 5, once per season
]);

function stageOk(challengeId, queensRemaining, episodeNum) {
  if (challengeId === "ball") {
    if (episodeNum <= 3 || queensRemaining === 5) return true;
    return false;
  }

  if (challengeId === "makeover") {
    return queensRemaining >= 5 && queensRemaining <= 6;
  }

  if (challengeId === "snatch_game") {
    return queensRemaining >= 8 && queensRemaining <= 10;
  }

  if (challengeId === "rusical") {
    return queensRemaining >= 10;
  }

  if (challengeId === "rumix") {
    return queensRemaining === 4;
  }

  if (challengeId === "roast") {
    return queensRemaining >= 5 && queensRemaining <= 7;
  }

  return true;
}

// Mini-challenge stage rules (for constraints)
function stageOkMini(challengeId, queensRemaining, episodeNum) {
  // Reading can only occur mid-season, 6–9 queens left.
  if (challengeId === "reading") {
    return queensRemaining >= 6 && queensRemaining <= 9;
  }

  // Puppets can only occur at top 5.
  if (challengeId === "puppets") {
    return queensRemaining === 5;
  }

  // Photoshoot must be the first mini-challenge of the season.
  if (challengeId === "photoshoot") {
    return episodeNum === 1;
  }

  // All others can occur at any time.
  return true;
}

function planRequiredSchedule(numQueens) {
  const schedule = {};
  const totalEpisodes = numQueens - 3;

  function queensAtEpisode(k) {
    return numQueens - (k - 1);
  }

  function pickEpisodeFor(challengeId, candidates) {
    const valid = candidates.filter(
      ep => ep >= 1 && ep <= totalEpisodes && schedule[ep] === undefined
    );
    if (!valid.length) return;
    const ep = choice(valid);
    schedule[ep] = challengeId;
  }

  // Snatch Game
  const snatchCandidates = [];
  for (let ep = 1; ep <= totalEpisodes; ep++) {
    const qCount = queensAtEpisode(ep);
    if (qCount >= 8 && qCount <= 10) snatchCandidates.push(ep);
  }
  pickEpisodeFor("snatch_game", snatchCandidates);

  // Makeover
  const makeoverCandidates = [];
  for (let ep = 1; ep <= totalEpisodes; ep++) {
    const qCount = queensAtEpisode(ep);
    if (qCount >= 5 && qCount <= 6) makeoverCandidates.push(ep);
  }
  pickEpisodeFor("makeover", makeoverCandidates);

  // Ball
  const earlyEps = [];
  for (let ep = 1; ep <= Math.min(3, totalEpisodes); ep++) {
    earlyEps.push(ep);
  }
  const lateEps = [];
  for (let ep = 1; ep <= totalEpisodes; ep++) {
    const qCount = queensAtEpisode(ep);
    if (qCount === 5) lateEps.push(ep);
  }
  const ballCandidates = Array.from(new Set([...earlyEps, ...lateEps]));
  pickEpisodeFor("ball", ballCandidates);

  return schedule;
}

function chooseChallenge(queensRemaining, episodeNum, lastChallengeId, usedOneOffIdsSet) {
  let candidates = CHALLENGES;

  // Avoid immediate repeats if possible
  if (lastChallengeId != null) {
    const nonRepeat = candidates.filter(c => c.id !== lastChallengeId);
    if (nonRepeat.length) candidates = nonRepeat;
  }

  // Filter out used one-offs and stage-inappropriate challenges
  let filtered = [];
  for (const c of candidates) {
    const cid = c.id;
    if (ONE_OFF_CHALLENGES.has(cid) && usedOneOffIdsSet.has(cid)) continue;
    if (!stageOk(cid, queensRemaining, episodeNum)) continue;
    filtered.push(c);
  }

  // Top 4 Rumix bias
  if (queensRemaining === 4 && !usedOneOffIdsSet.has("rumix")) {
    const rumixOptions = filtered.filter(c => c.id === "rumix");
    const others = filtered.filter(c => c.id !== "rumix");
    if (rumixOptions.length && others.length) {
      if (Math.random() < 0.7) {
        return choice(rumixOptions);
      }
      return choice(others);
    }
  }

  if (!filtered.length) {
    // Relax rules: ignore stage, still avoid reused one-offs if possible
    const relaxed = [];
    for (const c of CHALLENGES) {
      const cid = c.id;
      if (ONE_OFF_CHALLENGES.has(cid) && usedOneOffIdsSet.has(cid)) continue;
      if (lastChallengeId != null && cid === lastChallengeId) continue;
      relaxed.push(c);
    }
    filtered = relaxed.length ? relaxed : CHALLENGES;
  }

  return choice(filtered);
}

// Choose a mini-challenge for this episode.
function chooseMiniChallenge(queensRemaining, episodeNum, usedMiniOneOffIdsSet) {
  if (!MINI_CHALLENGES.length) return null;

  // Photoshoot *must* be the first mini-challenge of the season.
  if (episodeNum === 1) {
    const photo = MINI_CHALLENGES.find(c => c.id === "photoshoot");
    if (photo) {
      return photo;
    }
  }

  let candidates = MINI_CHALLENGES;

  let filtered = [];
  for (const c of candidates) {
    const cid = c.id;
    if (MINI_ONE_OFF_CHALLENGES.has(cid) && usedMiniOneOffIdsSet.has(cid)) continue;
    if (!stageOkMini(cid, queensRemaining, episodeNum)) continue;
    filtered.push(c);
  }

  if (!filtered.length) {
    // Relax stage rules but still respect one-offs.
    const relaxed = [];
    for (const c of MINI_CHALLENGES) {
      const cid = c.id;
      if (MINI_ONE_OFF_CHALLENGES.has(cid) && usedMiniOneOffIdsSet.has(cid)) continue;
      relaxed.push(c);
    }
    filtered = relaxed.length ? relaxed : MINI_CHALLENGES;
  }

  return choice(filtered);
}

// =========================
// Edit modifiers & scoring
// =========================

function applyEditModifiers(score, queen, challenge, context, phase) {
  const edits = queen.edits;

  if (edits.has("front_runner") && (context === "challenge" || context === "finale")) {
    score += 0.4;
  }

  if (edits.has("late_bloomer") && context === "challenge") {
    if (phase === "early") score -= 0.4;
    else if (phase === "late") score += 0.6;
  }

  if (edits.has("underestimated") && context === "challenge") {
    if (phase === "early") score -= 0.3;
    else if (phase === "late") score += 0.3;
  }

  if (edits.has("fan_favorite") && (context === "challenge" || context === "finale")) {
    score += 0.2;
  }

  if (edits.has("robbed") && context === "challenge") {
    score -= 0.3;
  }

  if (edits.has("villain") && context === "challenge") {
    score += randUniform(-0.8, 0.8);
  }

  if (edits.has("messy") && (context === "challenge" || context === "lipsync")) {
    score += randUniform(-1.2, 1.2);
  }

  if (edits.has("lip_sync_assassin") && (context === "lipsync" || context === "finale")) {
    score += 1.0;
  }

  return score;
}

function calculateScore(queen, challenge, phase = "early", context = "challenge") {
  let base = 0;
  for (const [stat, weight] of Object.entries(challenge.weights)) {
    base += (queen.stats[stat] || 0) * weight;
  }

  const variance = challenge.variance;
  const noise = randUniform(-variance, variance);

  let score = base + noise;

  if (queen.producer_fave) {
    score += 0.3;
  }

  score = applyEditModifiers(score, queen, challenge, context, phase);

  return score;
}

function adjustRankedForEdits(ranked) {
  const n = ranked.length;
  if (n < 3) return ranked;

  const list = ranked.slice();

  function isProtected(q) {
    return q.edits.has("fan_favorite") || q.edits.has("front_runner") || q.producer_fave;
  }

  function isExposed(q) {
    return q.edits.has("villain") || q.edits.has("messy") || q.edits.has("underestimated");
  }

  for (const bottomIdx of [n - 1, n - 2]) {
    const [qBottom, sBottom] = list[bottomIdx];
    if (!isProtected(qBottom)) continue;
    const swapIdx = bottomIdx - 1;
    if (swapIdx < 0) continue;
    const [qAbove, sAbove] = list[swapIdx];
    if (isExposed(qAbove) && (sAbove - sBottom) < 1.0) {
      const tmp = list[bottomIdx];
      list[bottomIdx] = list[swapIdx];
      list[swapIdx] = tmp;
    }
  }

  return list;
}

// =========================
// Episode simulation
// =========================

function resolveLipSync(bottom2, challenge, phase) {
  const performScores = new Map();
  for (const q of bottom2) {
    const s = calculateScore(q, challenge, phase, "lipsync") + randUniform(-1.0, 1.0);
    performScores.set(q, s);
  }
  const ranked = Array.from(performScores.entries()).sort((a, b) => b[1] - a[1]);
  const winner = ranked[0][0];
  const eliminated = ranked[1][0];
  return [winner, eliminated];
}

function updateTrackRecord(winner, highs, low, bottom2, eliminated) {
  for (const q of bottom2) {
    q.track_record.push("BTM");
  }
  if (low) {
    low.track_record.push("LOW");
  }
  for (const q of highs) {
    q.track_record.push("HIGH");
  }
  winner.track_record.push("WIN");

  const involved = new Set([...highs, ...bottom2, winner]);
  if (low) involved.add(low);

  for (const q of allQueensGlobal) {
    if (q.eliminated) continue;
    if (!involved.has(q) && q.track_record.length < winner.track_record.length) {
      q.track_record.push("SAFE");
    }
  }

  const lastIdx = eliminated.track_record.length - 1;
  if (lastIdx >= 0) {
    eliminated.track_record[lastIdx] = "ELIM";
  } else {
    eliminated.track_record.push("ELIM");
  }
  eliminated.eliminated = true;
}

function simulateEpisode(
  episodeNum,
  queens,
  lastChallengeId,
  usedOneOffIdsSet,
  requiredSchedule,
  totalEpisodes,
  log,
  usedMiniOneOffIdsSet
) {
  const queensRemaining = queens.length;
  const phase = episodeNum <= totalEpisodes / 2 ? "early" : "late";

  const scheduledId = requiredSchedule[episodeNum];

  let challenge;
  if (scheduledId !== undefined) {
    const candidates = CHALLENGES.filter(c => c.id === scheduledId);
    if (candidates.length) challenge = candidates[0];
    else challenge = chooseChallenge(queensRemaining, episodeNum, lastChallengeId, usedOneOffIdsSet);
  } else {
    challenge = chooseChallenge(queensRemaining, episodeNum, lastChallengeId, usedOneOffIdsSet);
  }

  const cid = challenge.id;

  if (ONE_OFF_CHALLENGES.has(cid)) {
    usedOneOffIdsSet.add(cid);
  }

  log.push(`\n========== Episode ${episodeNum} — ${challenge.name} ==========\n`);

  // Mini-challenge phase (no elimination impact yet)
  const miniChallenge = chooseMiniChallenge(queensRemaining, episodeNum, usedMiniOneOffIdsSet);
  if (miniChallenge) {
    if (MINI_ONE_OFF_CHALLENGES.has(miniChallenge.id)) {
      usedMiniOneOffIdsSet.add(miniChallenge.id);
    }

    log.push(`\nMini-Challenge — ${miniChallenge.name}\n`);

    const miniScores = new Map();
    for (const q of queens) {
      miniScores.set(q, calculateScore(q, miniChallenge, phase, "challenge"));
    }

    const miniRanked = Array.from(miniScores.entries()).sort((a, b) => b[1] - a[1]);
    const miniWinner = miniRanked[0][0];

    log.push("  Mini-challenge scores:\n");
    for (const [queen, score] of miniRanked) {
      log.push(`    ${queen.name.padEnd(14)} ${score.toFixed(2)}\n`);
    }
    log.push(`  Mini-challenge winner: ${miniWinner.name}\n`);
  }

  // Main challenge scores
  const scores = new Map();
  for (const q of queens) {
    scores.set(q, calculateScore(q, challenge, phase, "challenge"));
  }

  let ranked = Array.from(scores.entries()).sort((a, b) => b[1] - a[1]);
  ranked = adjustRankedForEdits(ranked);

  log.push("\nScores this week:\n");
  for (const [queen, score] of ranked) {
    log.push(`  ${queen.name.padEnd(14)} ${score.toFixed(2)}\n`);
  }

  const n = ranked.length;
  const winner = ranked[0][0];
  const bottom2 = [ranked[n - 2][0], ranked[n - 1][0]];
  const highIndicesEnd = Math.min(3, n - 2);
  const highs = [];
  for (let i = 1; i < highIndicesEnd; i++) {
    highs.push(ranked[i][0]);
  }
  let low = null;
  if (n > 4) {
    low = ranked[n - 3][0];
  }

  const [lipWinner, eliminated] = resolveLipSync(bottom2, challenge, phase);
  updateTrackRecord(winner, highs, low, bottom2, eliminated);

  log.push("\nResults:\n");
  log.push(`  Winner: ${winner.name}\n`);
  if (highs.length) {
    log.push(`  High:   ${highs.map(q => q.name).join(", ")}\n`);
  }
  if (low) {
    log.push(`  Low:    ${low.name}\n`);
  }
  log.push(`  Bottom: ${bottom2[0].name} vs. ${bottom2[1].name}\n`);
  log.push(`  Shantay you stay: ${lipWinner.name}\n`);
  log.push(`  Sashay away:      ${eliminated.name}\n`);

  return [eliminated, cid, usedOneOffIdsSet];
}

// =========================
// Track record + finale
// =========================

function formatTrackRecord(q) {
  const rec = [...q.track_record];
  const idx = rec.indexOf("ELIM");
  const trimmed = idx >= 0 ? rec.slice(0, idx + 1) : rec;
  return trimmed.join(" ");
}

function computeSeasonScore(q) {
  const rec = q.track_record;
  const wins = rec.filter(r => r === "WIN").length;
  const highs = rec.filter(r => r === "HIGH").length;
  const lows = rec.filter(r => r === "LOW").length;
  const btms = rec.filter(r => r === "BTM").length;

  let score = wins * 3 + highs * 1 - lows * 1 - btms * 2;

  if (q.edits.has("robbed")) score -= 1.0;

  return score;
}

function getLipsyncChallenge() {
  const found = CHALLENGES.find(c => c.id === "lipsync");
  if (found) return found;
  return {
    id: "lipsync",
    name: "Lipsync Challenge",
    weights: {
      dance: 0.45,
      improv: 0.25,
      acting: 0.15,
      runway: 0.15
    },
    variance: 2.3
  };
}

function simulateFinale(finalists, log) {
  const lipsyncChallenge = getLipsyncChallenge();

  log.push("\n========== Grand Finale — Lip Sync for the Crown ==========\n");
  log.push("Finalists:\n");
  for (const q of finalists) {
    log.push(`  - ${q.name} (track: ${formatTrackRecord(q)})\n`);
  }

  const seasonScores = new Map();
  for (const q of finalists) {
    seasonScores.set(q, computeSeasonScore(q));
  }

  const lipScores = new Map();
  for (const q of finalists) {
    lipScores.set(q, calculateScore(q, lipsyncChallenge, "late", "finale"));
  }

  const combinedScores = new Map();
  log.push("\nFinal lip sync performance:\n");
  for (const q of finalists) {
    const season = seasonScores.get(q);
    const rawLip = lipScores.get(q);
    const combined = rawLip + 0.4 * season + randUniform(-0.8, 0.8);
    combinedScores.set(q, combined);
    log.push(
      `  ${q.name.padEnd(14)} season=${season.toFixed(1).padStart(4)}  ` +
      `raw_lip=${rawLip.toFixed(2).padStart(5)}  combined=${combined.toFixed(2).padStart(5)}\n`
    );
  }

  let provisionalWinner = null;
  let bestCombined = -Infinity;
  for (const [q, s] of combinedScores.entries()) {
    if (s > bestCombined) {
      bestCombined = s;
      provisionalWinner = q;
    }
  }

  let winner = provisionalWinner;

  // Runaway frontrunner safety net
  let bestSeason = -Infinity;
  for (const s of seasonScores.values()) {
    if (s > bestSeason) bestSeason = s;
  }
  const frontrunners = [];
  for (const [q, s] of seasonScores.entries()) {
    if (s === bestSeason) frontrunners.push(q);
  }

  if (frontrunners.length === 1 && finalists.length > 1) {
    const f = frontrunners[0];

    const sortedSeasons = Array.from(seasonScores.values()).sort((a, b) => b - a);
    const secondBestSeason = sortedSeasons[1] !== undefined ? sortedSeasons[1] : bestSeason;
    const seasonMargin = bestSeason - secondBestSeason;

    if (seasonMargin >= 5) {
      let bestLip = -Infinity;
      for (const s of lipScores.values()) {
        if (s > bestLip) bestLip = s;
      }
      const lipGap = bestLip - lipScores.get(f);

      if (lipGap <= 3.0) {
        winner = f;
      }
    }
  }

  log.push(`\n${winner.name} devours the stage and snatches the crown! 👑\n`);
  return winner;
}

// =========================
// Season simulation (JS API)
// =========================

function simulateSeason(queenDefs, options = {}) {
  // Build queens from defs (with chaos/normal handling)
  const queens = buildQueensFromDefs(queenDefs, options);
  allQueensGlobal = queens.slice();

  let episodeNum = 1;
  let lastChallengeId = null;
  const usedOneOffIdsSet = new Set();
  const usedMiniOneOffIdsSet = new Set();

  const totalEpisodes = queens.length - 3;
  const requiredSchedule = planRequiredSchedule(queens.length);

  const log = [];

  log.push("========== Drag Race Season Simulation ==========\n");
  log.push("Starting queens:\n");
  for (const q of queens) {
    log.push(`  - ${q.name}\n`);
  }
  log.push("\n");

  if (Object.keys(requiredSchedule).length) {
    log.push("Planned must-have challenges:\n");
    const eps = Object.keys(requiredSchedule)
      .map(e => parseInt(e, 10))
      .sort((a, b) => a - b);
    for (const ep of eps) {
      log.push(`  Episode ${ep}: ${requiredSchedule[ep]}\n`);
    }
    log.push("\n");
  }

  while (queens.length > 3 && episodeNum <= totalEpisodes) {
    const [eliminated, cid] = simulateEpisode(
      episodeNum,
      queens,
      lastChallengeId,
      usedOneOffIdsSet,
      requiredSchedule,
      totalEpisodes,
      log,
      usedMiniOneOffIdsSet
    );
    lastChallengeId = cid;
    queens.splice(queens.indexOf(eliminated), 1);
    episodeNum += 1;
  }

  log.push("\n========== Final 3 ==========\n");
  for (const q of queens) {
    log.push(`  - ${q.name} (track record: ${formatTrackRecord(q)})\n`);
  }

  const winner = simulateFinale(queens, log);

  log.push(`\nAnd the winner of this season is... ${winner.name}!! 🏁👑\n`);
  log.push("\nFull track records:\n");
  for (const q of allQueensGlobal) {
    log.push(`  ${q.name.padEnd(14)} ${formatTrackRecord(q)}\n`);
  }

  return log.join("");
}

// expose to window
window.simulateSeason = simulateSeason;
