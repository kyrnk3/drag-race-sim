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
// Expose for the UI/custom-queen editor
window.ALL_EDIT_FLAGS = ALL_EDIT_FLAGS;

// Core challenge stats (lipsync is derived / added on top of these).
// "design" is included for ball / design-heavy challenges.
// All stats are conceptually on a 0–10 scale (0 = terrible, 10 = legendary).
const STAT_NAMES = ["runway", "comedy", "acting", "dance", "singing", "improv", "design"];

// Main challenges from challenges.js
const CHALLENGES = window.CHALLENGES || [];

// Mini-challenges from mini-challenges.js
const MINI_CHALLENGES = window.MINI_CHALLENGES || [];

// Will store all queens for SAFE padding logic & track-record meta.
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

// Runway category picker (avoids repeats until pool is exhausted).
function pickRunwayCategory(usedSet, forceCategory = null) {
  if (forceCategory) return forceCategory;
  const cats = Array.isArray(window.RUNWAY_CATEGORIES) ? window.RUNWAY_CATEGORIES : [];
  if (!cats.length) return null;

  const used = usedSet instanceof Set ? usedSet : new Set();
  const available = cats.filter(c => !used.has(c));
  const pool = available.length ? available : cats;
  const chosen = pool[Math.floor(Math.random() * pool.length)];
  used.add(chosen);
  return chosen;
}

// Clamp to the 0–10 scale we’re using everywhere.
function clampStat(x) {
  return Math.max(0, Math.min(10, x));
}

// =========================
// Queen class
// =========================

class Queen {
  constructor(name, stats, dramaProne = false, producerFave = false, edits = []) {
    this.name = name;
    // stats: {runway, comedy, acting, dance, singing, improv, design, lipsync}
    this.stats = stats;
    this.drama_prone = dramaProne;
    this.producer_fave = producerFave;
    this.edits = new Set(edits || []);
    this.track_record = []; // ["WIN", "HIGH", "SAFE", "BTM", "ELIM"]
    // Per-episode immunity flags (true if this queen was immune that week)
    this.immunityHistory = [];
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

// Build a lipsync stat from existing performance stats.
function generateLipsyncFromStats(stats, editsSet) {
  const dance   = stats.dance   != null ? stats.dance   : 5;
  const comedy  = stats.comedy  != null ? stats.comedy  : 5;
  const singing = stats.singing != null ? stats.singing : 5;

  // Core: queens who can move (dance), emote/perform (comedy), and sell lyrics (singing)
  let base =
    dance   * 0.45 +
    comedy  * 0.35 +
    singing * 0.20;

  // Normalize-ish and add some personality noise
  base = base + randUniform(-1.0, 1.0);

  // Lip sync assassins get a strong natural boost
  if (editsSet && editsSet.has("lip_sync_assassin")) {
    base += 1.5;
  }

  // Messy queens are swingy – they can flop or eat
  if (editsSet && editsSet.has("messy")) {
    base += randUniform(-0.7, 0.7);
  }

  return clampStat(Math.round(base));
}

function generateRandomStats(editsSet) {
  // Base random stats 3–9 for core stats (not lipsync yet)
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
    // Still boost dance/improv a bit – they're usually killers in performance
    stats["dance"]  = Math.min(10, stats["dance"]  + 2);
    stats["improv"] = Math.min(10, stats["improv"] + 1);
  }

  // late_bloomer handled via timing, not raw stats

  for (const k of STAT_NAMES) {
    stats[k] = clampStat(stats[k]);
  }

  // Now derive lipsync from the resulting performance profile
  stats.lipsync = generateLipsyncFromStats(stats, editsSet);

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
    const statsEntry = entry.stats || null;

    // In chaos mode we always randomize; otherwise we only randomize if
    // there is *no* stats object at all. Partial stats are allowed.
    const needRandom = chaosMode || (autoGenStats && !statsEntry);

    let stats;
    if (needRandom || !statsEntry) {
      // Full random, including derived lipsync
      stats = generateRandomStats(editsSet);
    } else {
      // Copy whatever stats were provided, then fill gaps with a neutral default (5).
      stats = {};

      for (const k of STAT_NAMES) {
        if (statsEntry[k] != null) {
          stats[k] = clampStat(statsEntry[k]);
        }
      }

      // Fill any missing core stats with a mid-range default
      for (const k of STAT_NAMES) {
        if (stats[k] == null) stats[k] = 5;
      }

      // Lipsync: use provided value if present, otherwise derive from the profile
      if ("lipsync" in statsEntry && statsEntry.lipsync != null) {
        stats.lipsync = clampStat(statsEntry.lipsync);
      } else {
        stats.lipsync = generateLipsyncFromStats(stats, editsSet);
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
    // HARD RULE: cannot occur before Episode 4
    if (episodeNum < 4) return false;
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
    // Baseline assumption: 1 elimination per episode.
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

  // Snatch Game (Episode >= 4, 8–10 queens)
  const snatchCandidates = [];
  for (let ep = 4; ep <= totalEpisodes; ep++) {
    const qCount = queensAtEpisode(ep);
    if (qCount >= 8 && qCount <= 10) snatchCandidates.push(ep);
  }
  pickEpisodeFor("snatch_game", snatchCandidates);

  // Makeover (5–6 queens)
  const makeoverCandidates = [];
  for (let ep = 1; ep <= totalEpisodes; ep++) {
    const qCount = queensAtEpisode(ep);
    if (qCount >= 5 && qCount <= 6) makeoverCandidates.push(ep);
  }
  pickEpisodeFor("makeover", makeoverCandidates);

  // Ball (early OR top 5)
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

  // Small runway influence on most challenges (centered around 5 so it doesn't inflate scores).
  // Skips runway-heavy challenges (ball/makeover) or any challenge that already weights runway strongly.
  if (context === "challenge") {
    const cid = challenge && challenge.id ? challenge.id : null;
    const runwayWeight = (challenge && challenge.weights && challenge.weights.runway != null) ? challenge.weights.runway : 0;
    const runwayHeavy = (cid === "ball" || cid === "makeover" || runwayWeight >= 0.20);
    if (!runwayHeavy) {
      const runwayStat = (queen.stats && queen.stats.runway != null) ? queen.stats.runway : 5;
      score += (runwayStat - 5) * 0.25;
    }
  }

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
// Performance tiers + Runway segment (UI-safe structured data)
// =========================

// Compute mean/stddev for an array of numbers.
function meanStd(values) {
  if (!values || !values.length) return { mean: 0, std: 1 };
  let sum = 0;
  for (const v of values) sum += v;
  const mean = sum / values.length;

  let varSum = 0;
  for (const v of values) {
    const d = v - mean;
    varSum += d * d;
  }
  const variance = varSum / values.length;
  const std = Math.sqrt(variance) || 1;
  return { mean, std };
}

// Threshold-based tiers (not quota-based), so slayed/bombed are NOT guaranteed.
function tierFromZ(z) {
  if (z >= 1.25) return "slayed";
  if (z >= 0.50) return "great";
  if (z > -0.50) return "good";
  if (z > -1.25) return "bad";
  return "bombed";
}

// Runway segment scoring: mostly runway stat + light noise.
// This is separate from main challenge scoring; it's for UI + flavor.
function calculateRunwayScore(queen) {
  const runwayStat = (queen.stats && queen.stats.runway != null) ? queen.stats.runway : 5;
  let s = runwayStat + randUniform(-1.0, 1.0);

  // Light narrative sway (kept smaller than challenge edits).
  if (queen.producer_fave) s += 0.2;
  if (queen.edits && queen.edits.has("front_runner")) s += 0.2;
  if (queen.edits && queen.edits.has("messy")) s += randUniform(-0.4, 0.4);
  if (queen.edits && queen.edits.has("villain")) s += randUniform(-0.2, 0.2);

  return s;
}

// =========================
// Double Shantay / Double Sashay helpers
// =========================

function hasDoubleShantayTag(q) {
  return q.edits.has("front_runner") ||
         q.edits.has("lip_sync_assassin") ||
         q.producer_fave;
}

function hasDoubleSashayTag(q) {
  return q.edits.has("robbed") ||
         q.edits.has("messy") ||
         q.drama_prone;
}

// =========================
// Episode simulation
// =========================

function resolveLipSync(bottom2, challenge, phase, twistState) {
  const performScores = new Map();
  for (const q of bottom2) {
    const s = calculateScore(q, challenge, phase, "lipsync") + randUniform(-1.0, 1.0);
    performScores.set(q, s);
  }

  const ranked = Array.from(performScores.entries()).sort((a, b) => b[1] - a[1]);
  const winner = ranked[0][0];
  const eliminated = ranked[1][0];
  const sWinner = ranked[0][1];
  const sLoser = ranked[1][1];

  // Performance tiers for the bottom 2 (for UI/flavor text)
  const _vals = [sWinner, sLoser];
  const _stats = meanStd(_vals);
  const lipTiers = ranked.map(([q, s]) => {
    const z = (s - _stats.mean) / _stats.std;
    return { name: q.name, score: s, z, tier: tierFromZ(z) };
  });

  let twist = "none";

  // Thresholds for “slay” and “bomb”
  const highThreshold = 8.0;    // unchanged – really strong lip sync
  const bombThreshold = 4.0;    // was 3.0 – now includes more obvious flops
  const disasterThreshold = 2.0; // “truly awful” territory

  const bothSlay = (sWinner >= highThreshold && sLoser >= highThreshold);
  const bothBomb = (sWinner <= bombThreshold && sLoser <= bombThreshold);
  const oneDisaster = (Math.min(sWinner, sLoser) <= disasterThreshold);

  // =========================
  // Double SHANTAY (unchanged)
  // =========================
  if (
    bothSlay &&
    twistState.doubleShantayEnabled &&
    !twistState.usedDoubleShantay
  ) {
    let chance = 0.12; // base low–medium chance

    // Boost if the provisional loser is a protected narrative fave
    if (hasDoubleShantayTag(eliminated)) {
      chance += 0.20;
    }
    // Smaller boost if the winner also has those tags
    if (hasDoubleShantayTag(winner)) {
      chance += 0.10;
    }

    chance = Math.min(Math.max(chance, 0), 0.9);

    if (Math.random() < chance) {
      twist = "double_shantay";
      twistState.usedDoubleShantay = true;
      return { lipWinner: winner, eliminated: null, twist };
    }
  }

  // =========================
  // Double SASHAY (more permissive)
  // =========================
  // Triggers when:
  //  - both queens are clear flops (<= bombThreshold), OR
  //  - at least one queen is a total disaster (<= disasterThreshold)
  if (
    (bothBomb || oneDisaster) &&
    twistState.doubleSashayEnabled &&
    !twistState.usedDoubleSashay
  ) {
    let chance = 0.14; // slightly higher base than before

    // Boost if the *winner* is messy/drama/robbed (producers love chaos)
    if (hasDoubleSashayTag(winner)) {
      chance += 0.20;
    }
    // Smaller boost if the other queen is also messy/robbed/drama
    if (hasDoubleSashayTag(eliminated)) {
      chance += 0.10;
    }

    chance = Math.min(Math.max(chance, 0), 0.9);

    if (Math.random() < chance) {
      twist = "double_sashay";
      twistState.usedDoubleSashay = true;
      return { lipWinner: null, eliminated: null, twist };
    }
  }

  // =========================
  // Normal outcome
  // =========================
  return { lipWinner: winner, eliminated, twist };
}

  function updateTrackRecord(
    episodeIndex,
    activeQueens,
    winner,
    highs,
    low,
    bottom2,
    eliminatedList,
    immuneSet
  ) {
    const immuneQueens = immuneSet || new Set();
  
    // 1) Ensure every ACTIVE queen has a slot for this episode (default SAFE).
    for (const q of activeQueens) {
      // If something drifted earlier, hard-pad up to this episode with SAFE.
      while (q.track_record.length < episodeIndex) {
        q.track_record.push("SAFE");
      }
      if (q.track_record.length === episodeIndex) {
        q.track_record.push("SAFE");
      } else {
        // If it already exists (shouldn't normally), keep it unless blank.
        if (!q.track_record[episodeIndex]) q.track_record[episodeIndex] = "SAFE";
      }
  
      // Immunity history stays aligned to episodeIndex for ACTIVE queens only.
      if (!q.immunityHistory) q.immunityHistory = [];
      while (q.immunityHistory.length < episodeIndex) {
        q.immunityHistory.push(false);
      }
      q.immunityHistory[episodeIndex] = immuneQueens.has(q);
    }
  
    // 2) Apply placements (overwrite the SAFE slot).
    if (bottom2 && bottom2.length) {
      for (const q of bottom2) {
        if (q && !q.eliminated) q.track_record[episodeIndex] = "BTM";
      }
    }
  
    if (low && !low.eliminated) {
      low.track_record[episodeIndex] = "LOW";
    }
  
    if (highs && highs.length) {
      for (const q of highs) {
        if (q && !q.eliminated) q.track_record[episodeIndex] = "HIGH";
      }
    }
  
    if (winner && !winner.eliminated) {
      winner.track_record[episodeIndex] = "WIN";
    }
  
    // 3) Mark eliminations LAST (overwrite whatever they had this episode).
    for (const elim of (eliminatedList || [])) {
      if (!elim) continue;
      // Make sure they have the episode slot (they were active this episode).
      while (elim.track_record.length <= episodeIndex) {
        elim.track_record.push("SAFE");
      }
      elim.track_record[episodeIndex] = "ELIM";
      elim.eliminated = true;
    }
  }

function simulateEpisode(
  episodeNum,
  queens,
  lastChallengeId,
  usedOneOffIdsSet,
  requiredSchedule,
  totalEpisodes,
  log,
  usedMiniOneOffIdsSet,
  immunityState,
  twistState,
  runwayState,
  lipsyncState
) {
  const queensRemaining = queens.length;
  const phase = episodeNum <= totalEpisodes / 2 ? "early" : "late";

  // Determine who is immune this episode.
  const currentImmuneSet = new Set();
  if (immunityState && immunityState.enabled && immunityState.current) {
    currentImmuneSet.add(immunityState.current);
  }

  const scheduledId = requiredSchedule[episodeNum];

  let challenge = null;
  if (scheduledId !== undefined) {
    const canUseScheduled =
      !(ONE_OFF_CHALLENGES.has(scheduledId) && usedOneOffIdsSet.has(scheduledId));
    if (canUseScheduled) {
      const candidates = CHALLENGES.filter(c => c.id === scheduledId);
      if (candidates.length) challenge = candidates[0];
    }
  }

  if (!challenge) {
    challenge = chooseChallenge(queensRemaining, episodeNum, lastChallengeId, usedOneOffIdsSet);
  }

  const cid = challenge.id;

  if (ONE_OFF_CHALLENGES.has(cid)) {
    usedOneOffIdsSet.add(cid);
  }

  log.push(`
========== Episode ${episodeNum} — ${challenge.name} ==========
`);

  // Runway category for this episode (shared pool across the season)
  const runwayCategory = pickRunwayCategory(runwayState ? runwayState.usedCategories : null);

  // Mini-challenge phase
  const miniChallenge = chooseMiniChallenge(queensRemaining, episodeNum, usedMiniOneOffIdsSet);
  let miniWinner = null;
  if (miniChallenge) {
    if (MINI_ONE_OFF_CHALLENGES.has(miniChallenge.id)) {
      usedMiniOneOffIdsSet.add(miniChallenge.id);
    }

    log.push(`
Mini-Challenge — ${miniChallenge.name}
`);

    const miniScores = new Map();
    for (const q of queens) {
      miniScores.set(q, calculateScore(q, miniChallenge, phase, "challenge"));
    }

    const miniRanked = Array.from(miniScores.entries()).sort((a, b) => b[1] - a[1]);
    miniWinner = miniRanked[0][0];
    log.push(`  Mini-challenge winner: ${miniWinner.name}
`);
  }

  // Main challenge scores (judging)
  const scores = new Map();
  for (const q of queens) {
    scores.set(q, calculateScore(q, challenge, phase, "challenge"));
  }

  let ranked = Array.from(scores.entries()).sort((a, b) => b[1] - a[1]);
  ranked = adjustRankedForEdits(ranked);

  const n = ranked.length;
  const winner = ranked[0][0];

  // Bottom 2: among non-immune queens only
  const nonImmuneRanked = ranked.filter(([q]) => !currentImmuneSet.has(q));
  const m = nonImmuneRanked.length;
  const bottom2 = [nonImmuneRanked[m - 2][0], nonImmuneRanked[m - 1][0]];

  const highIndicesEnd = Math.min(3, n - 2);
  const highs = [];
  for (let i = 1; i < highIndicesEnd; i++) {
    highs.push(ranked[i][0]);
  }

  let low = null;
  if (n > 4) {
    low = ranked[n - 3][0];
  }

  const lipsyncChallenge = getLipsyncChallenge();
  const lipOutcome = resolveLipSync(bottom2, lipsyncChallenge, phase, twistState);

  // Pick a lip-sync song (no repeats until the pool is exhausted)
  const _usedSongs = (lipsyncState && lipsyncState.usedSongs) ? lipsyncState.usedSongs : new Set();
  const lipsyncSong = (typeof window !== "undefined" && window.pickLipSyncSong)
    ? window.pickLipSyncSong(_usedSongs)
    : null;

  let eliminatedList = [];
  if (lipOutcome.twist === "double_shantay") {
    eliminatedList = [];
  } else if (lipOutcome.twist === "double_sashay") {
    eliminatedList = [...bottom2];
  } else {
    eliminatedList = [lipOutcome.eliminated];
  }

  // Track record update (unchanged)
  updateTrackRecord(
    episodeNum - 1,
    queens,
    winner,
    highs,
    low,
    bottom2,
    eliminatedList,
    currentImmuneSet
  );

  // =========================
  // Episode narrative log (marker-based, for UI sections)
  // =========================

  // Maxi challenge section is already logged earlier in the function.

  log.push("\nBased on tonight's performances...\n");
  log.push(`  Winner: ${winner.name}\n`);
  if (highs.length) log.push(`  High:   ${highs.map(q => q.name).join(", ")}\n`);
  if (low) log.push(`  Low:    ${low.name}\n`);

  log.push("\nBring back my girls!\n");
  log.push("Ladies, I've made some decisions...\n");
  log.push(`  Bottom: ${bottom2[0].name} vs. ${bottom2[1].name}\n`);

  log.push("\nThe time has come...\n");
  log.push("For you to lip-sync... for your lives! Good luck and don't fuck it up.\n");
  if (lipsyncSong) {
    log.push(`The lip-sync song is... ${lipsyncSong}!\n\n`);
  }

  const tierToPhrase = (tier) => {
    switch (tier) {
      case "slayed": return "slayed";
      case "great":  return "had a great";
      case "good":   return "had a good";
      case "bad":    return "had a bad";
      default:       return "bombed";
    }
  };

  if (lipOutcome.lipTiers && lipOutcome.lipTiers.length) {
    for (const t of lipOutcome.lipTiers) {
      const phr = tierToPhrase(t.tier);
      if (phr === "slayed") log.push(`${t.name} slayed the lip-sync...\n`);
      else if (phr === "bombed") log.push(`${t.name} bombed the lip-sync...\n`);
      else log.push(`${t.name} ${phr} lip-sync...\n`);
    }
    log.push("\n");
  }

  log.push("I've made my decision.\n");

  if (lipOutcome.twist === "double_shantay") {
    log.push("SPECIAL TWIST: DOUBLE SHANTAY! Both queens stay.\n");
    log.push(`Shantay you stay: ${bottom2[0].name} & ${bottom2[1].name}\n`);
    log.push("Sashay away:      (no one!)\n");
  } else if (lipOutcome.twist === "double_sashay") {
    log.push("SPECIAL TWIST: DOUBLE SASHAY! Both queens go home.\n");
    log.push("Shantay you stay: (no one!)\n");
    log.push(`Sashay away:      ${bottom2[0].name} & ${bottom2[1].name}\n`);
  } else {
    log.push(`Shantay you stay: ${lipOutcome.lipWinner.name}\n`);
    log.push(`Sashay away:      ${lipOutcome.eliminated.name}\n`);
  }

  // Decide who gets immunity for the next episode (if the twist is active).
  if (immunityState && immunityState.enabled) {
    const nextCount = queensRemaining - eliminatedList.length;
    if (nextCount > immunityState.cutoff) {
      immunityState.next = winner;
    } else {
      immunityState.next = null;
    }
  }

  // =========================
  // Structured episode results (for UI)
  // =========================

  // Placement map (rank-based judging outcome).
  const placementMap = new Map();
  placementMap.set(winner, "WIN");
  for (const q of highs) placementMap.set(q, "HIGH");
  if (low) placementMap.set(low, "LOW");
  for (const q of bottom2) placementMap.set(q, "BTM");

  const eliminatedSet = new Set((eliminatedList || []).filter(Boolean));

  // Performance tiers are threshold-based across ALL queens (immune included),
  // but we keep finalRank based on the FINAL judging order (after edit-adjustment).
  const scoreVals = Array.from(scores.values());
  const perfStats = meanStd(scoreVals);

  const tiers = ranked.map(([q], idx) => {
    const s = scores.get(q);
    const z = (s - perfStats.mean) / perfStats.std;
    return {
      name: q.name,
      score: s,
      z,
      tier: tierFromZ(z),
      immune: currentImmuneSet.has(q),
      finalRank: idx + 1,
      placement: placementMap.get(q) || "SAFE",
      eliminated: eliminatedSet.has(q)
    };
  });

  // Runway segment tiers (immune included; can bomb while safe).
  const runwayScoreMap = new Map();
  for (const q of queens) {
    runwayScoreMap.set(q, calculateRunwayScore(q));
  }
  const runwayRanked = Array.from(runwayScoreMap.entries()).sort((a, b) => b[1] - a[1]);
  const runwayVals = runwayRanked.map(([, s]) => s);
  const runwayStats = meanStd(runwayVals);

  const runwayTiers = runwayRanked.map(([q, s], idx) => {
    const z = (s - runwayStats.mean) / runwayStats.std;
    return {
      name: q.name,
      score: s,
      z,
      tier: tierFromZ(z),
      immune: currentImmuneSet.has(q),
      runwayRank: idx + 1
    };
  });

  const episodeResult = {
    episode: episodeNum,
    phase,
    challengeId: cid,
    challengeName: challenge.name,
    miniChallenge: miniChallenge
      ? { id: miniChallenge.id, name: miniChallenge.name, winner: (miniWinner ? miniWinner.name : null) }
      : null,
    twist: lipOutcome.twist,
    tiers,
    runwayTiers,
    runwayCategory,
    lipSync: { song: lipsyncSong, tiers: (lipOutcome.lipTiers || []) }
  };

  return { eliminatedList, cid, twist: lipOutcome.twist, episodeResult };
}

// =========================
// Track record + finale
// =========================

function formatTrackRecord(q) {
  const raw = q.track_record || [];
  const imm = q.immunityHistory || [];

  // Annotate placements with (IMM) where applicable (except ELIM)
  const annotated = raw.map((status, idx) => {
    const hasImm = !!imm[idx];
    if (hasImm && status !== "ELIM") {
      return status + "(IMM)";
    }
    return status;
  });

  const idx = raw.indexOf("ELIM");
  const trimmed = idx >= 0 ? annotated.slice(0, idx + 1) : annotated;
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
  // Fallback if no explicit lipsync challenge defined in CHALLENGES
  return {
    id: "lipsync",
    name: "Lipsync Challenge",
    weights: {
      lipsync: 0.5,
      dance: 0.25,
      improv: 0.15,
      runway: 0.10
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
  for (const q of finalists) {
    const season = seasonScores.get(q);
    const rawLip = lipScores.get(q);
    const combined = rawLip + 0.4 * season + randUniform(-0.8, 0.8);
    combinedScores.set(q, combined);
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
  return { winner, seasonScores, lipScores, combinedScores };
}

// Build structured track-record data for the UI table.
function buildTrackRecordMeta(allQueens, winner, finalists) {
  if (!allQueens || !allQueens.length) {
    return { queenOrder: [], episodes: [] };
  }

  // Determine how many main episodes actually happened.
  let mainEpisodeCount = 0;
  for (const q of allQueens) {
    if (q.track_record && q.track_record.length > mainEpisodeCount) {
      mainEpisodeCount = q.track_record.length;
    }
  }

  const finalistsSet = new Set(finalists || []);

    // Ensure every non-finalist has an ELIM marker somewhere in their track record.
  // If they never got one (due to a bookkeeping edge case), mark their last episode as ELIM.
  for (const q of allQueens) {
    if (finalistsSet.has(q)) continue;
    const rec = q.track_record || [];
    if (rec.length && !rec.includes("ELIM")) {
      rec[rec.length - 1] = "ELIM";
    }
  }

  // Label duplicates nicely so cursed seasons don't collapse into one row.
  const nameCounts = new Map();
  for (const q of allQueens) {
    const base = q.name || "Unknown";
    nameCounts.set(base, (nameCounts.get(base) || 0) + 1);
  }

  const usedCounts = new Map();
  const queenLabelMap = new Map();
  function makeLabel(q) {
    const base = q.name || "Unknown";
    const total = nameCounts.get(base) || 1;
    if (total === 1) return base;
    const used = (usedCounts.get(base) || 0) + 1;
    usedCounts.set(base, used);
    return `${base} #${used}`;
  }
  for (const q of allQueens) {
    queenLabelMap.set(q, makeLabel(q));
  }

  // Split finalists vs non-finalists, order by placement.
  const nonFinalists = allQueens.filter(q => !finalistsSet.has(q));
  nonFinalists.sort((a, b) => {
    const ea = a.track_record.indexOf("ELIM");
    const eb = b.track_record.indexOf("ELIM");
    // Later elimination (higher index) should rank higher.
    return eb - ea;
  });

  const otherFinalists = finalists.filter(q => q !== winner);
  otherFinalists.sort((a, b) => computeSeasonScore(b) - computeSeasonScore(a));

  const orderingObjs = [winner, ...otherFinalists, ...nonFinalists].filter(Boolean);
  const queenOrder = orderingObjs.map(q => queenLabelMap.get(q));

  const episodes = [];

  // Main episodes
  for (let ep = 0; ep < mainEpisodeCount; ep++) {
    const placements = {};
    for (const q of orderingObjs) {
      const label = queenLabelMap.get(q);
      const status = q.track_record[ep] || "";
      // Use the per-queen immunityHistory we record in updateTrackRecord
      const immune =
        q.immunityHistory && q.immunityHistory[ep]
          ? true
          : false;
      placements[label] = { status, immune };
    }
    episodes.push({
      index: ep,
      isFinale: false,
      name: `Episode ${ep + 1}`,
      placements
    });
  }

  // Finale column: Winner (gold), runner-up (silver), third (bronze). Others blank.
  const finalePlacements = {};
  orderingObjs.forEach((q, idx) => {
    const label = queenLabelMap.get(q);
    let status = "";
    if (idx === 0) status = "WIN";                 // winner
    else if (idx === 1 && finalists.length > 1) status = "RU2"; // 2nd place
    else if (idx === 2 && finalists.length > 2) status = "RU3"; // 3rd place
    finalePlacements[label] = status;
  });

  episodes.push({
    index: mainEpisodeCount,
    isFinale: true,
    name: "Finale",
    placements: finalePlacements
  });

  return { queenOrder, episodes };
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

  const startingQueens = queens.length;
  const totalEpisodes = startingQueens - 3; // baseline, used for phase + scheduling
  const requiredSchedule = planRequiredSchedule(startingQueens);

  const eliminationsNeeded = startingQueens - 3; // want a Top 3
  let eliminationsDone = 0;

  // Safety cap: allows extra episodes from double shantays,
  // but prevents infinite seasons if something goes wrong.
  const maxEpisodes = startingQueens + 10;

  const log = [];
  const episodeResults = [];

  // Immunity twist configuration
  // Accept both old API (immunityEnabled) and UI key (enableImmunity).
  const uiImmunity = options.enableImmunity;
  const baseImmunity = options.immunityEnabled;
  const immunityEnabled =
    baseImmunity !== undefined
      ? !!baseImmunity
      : uiImmunity !== undefined
        ? !!uiImmunity
        : true;

  const immunityCutoff = Math.random() < 0.5 ? 7 : 8;
  const immunityState = {
    enabled: immunityEnabled,
    cutoff: immunityCutoff,
    current: null,
    next: null
  };

  // Double Shantay/Sashay configuration
  // Accept both old API (doubleLipSyncTwistsEnabled) and UI key (enableDoubleTwists).
  const uiDouble = options.enableDoubleTwists;
  const baseDouble = options.doubleLipSyncTwistsEnabled;
  const twistsToggle =
    baseDouble !== undefined
      ? !!baseDouble
      : uiDouble !== undefined
        ? !!uiDouble
        : true;

  const twistState = {
    doubleShantayEnabled:
      options.doubleShantayEnabled === undefined
        ? twistsToggle
        : !!options.doubleShantayEnabled,
    doubleSashayEnabled:
      options.doubleSashayEnabled === undefined
        ? twistsToggle
        : !!options.doubleSashayEnabled,
    usedDoubleShantay: false,
    usedDoubleSashay: false
  };

  // Runway category state (no repeats until pool exhausted)
  const runwayState = { usedCategories: new Set() };

  // Lip-sync song state (no repeats until pool exhausted)
  const lipsyncState = { usedSongs: new Set() };

  log.push("========== Drag Race Season Simulation ==========\n");
  log.push("Starting queens:\n");
  for (const q of queens) {
    log.push(`  - ${q.name}\n`);
  }
  log.push("\n");

  if (Object.keys(requiredSchedule).length) {
    log.push("Planned must-have challenges (baseline assumptions):\n");
    const eps = Object.keys(requiredSchedule)
      .map(e => parseInt(e, 10))
      .sort((a, b) => a - b);
    for (const ep of eps) {
      log.push(`  Episode ${ep}: ${requiredSchedule[ep]}\n`);
    }
    log.push("\n");
  }

  if (immunityState.enabled) {
    log.push(`Immunity twist: active until the cast reaches Top ${immunityState.cutoff}.\n\n`);
  } else {
    log.push("Immunity twist: disabled for this run.\n\n");
  }

  // Loop is driven by eliminations, not a fixed episode cap.
  while (
    queens.length > 3 &&
    eliminationsDone < eliminationsNeeded &&
    episodeNum <= maxEpisodes
  ) {
    const queensRemaining = queens.length;

    // Decide who (if anyone) is immune this episode
    if (!immunityState.enabled) {
      immunityState.current = null;
    } else {
      if (episodeNum === 1) {
        // No immunity in Episode 1
        immunityState.current = null;
      } else if (queensRemaining <= immunityState.cutoff) {
        // Once we reach Top 7/8, immunity is fully phased out.
        immunityState.current = null;
      } else {
        // Use the queen who earned immunity last episode, if she's still in.
        if (immunityState.next && !queens.includes(immunityState.next)) {
          immunityState.next = null;
        }
        immunityState.current = immunityState.next || null;
      }
    }

    const { eliminatedList, cid, episodeResult } = simulateEpisode(
      episodeNum,
      queens,
      lastChallengeId,
      usedOneOffIdsSet,
      requiredSchedule,
      totalEpisodes,
      log,
      usedMiniOneOffIdsSet,
      immunityState,
      twistState,
      runwayState,
      lipsyncState
    );
    lastChallengeId = cid;
    if (episodeResult) episodeResults.push(episodeResult);

    // Remove all eliminated queens from the active cast
    for (const elim of eliminatedList) {
      const idx = queens.indexOf(elim);
      if (idx >= 0) {
        queens.splice(idx, 1);
      }
    }

    // Count how many eliminations actually occurred this week.
    eliminationsDone += eliminatedList.length;

    episodeNum += 1;
  }

  log.push("\n========== Final 3 ==========\n");
  for (const q of queens) {
    log.push(`  - ${q.name} (track record: ${formatTrackRecord(q)})\n`);
  }

  const finalists = queens.slice();
  const finaleResult = simulateFinale(finalists, log);
  const winner = finaleResult.winner;

  log.push(`\nAnd the winner of this season is... ${winner.name}!! 🏁👑\n`);
  log.push("\nFull track records:\n");
  for (const q of allQueensGlobal) {
    log.push(`  ${q.name.padEnd(14)} ${formatTrackRecord(q)}\n`);
  }


  // Add a Finale runway entry for UI flows that want a finale runway segment.
  // (Category is always Finale Eleganza Extravaganza.)
  const finaleRunwayScoreMap = new Map();
  for (const q of finalists) {
    finaleRunwayScoreMap.set(q, calculateRunwayScore(q));
  }
  const finaleRunwayRanked = Array.from(finaleRunwayScoreMap.entries()).sort((a, b) => b[1] - a[1]);
  const finaleRunwayVals = finaleRunwayRanked.map(([, s]) => s);
  const finaleRunwayStats = meanStd(finaleRunwayVals);
  const finaleRunwayTiers = finaleRunwayRanked.map(([q, s], idx) => {
    const z = (s - finaleRunwayStats.mean) / finaleRunwayStats.std;
    return {
      name: q.name,
      score: s,
      z,
      tier: tierFromZ(z),
      immune: false,
      runwayRank: idx + 1
    };
  });

  episodeResults.push({
    episode: "Finale",
    phase: "finale",
    challengeId: "FINALE",
    challengeName: "Grand Finale",
    miniChallenge: null,
    twist: null,
    tiers: [],
    runwayTiers: finaleRunwayTiers,
    runwayCategory: "Finale Eleganza Extravaganza"
  });

  const trackRecord = buildTrackRecordMeta(allQueensGlobal, winner, finalists);

  return {
    log: log.join(""),
    trackRecord,
    episodeResults
  };
}

// expose to window
window.simulateSeason = simulateSeason;
