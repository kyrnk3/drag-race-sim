// mini-challenges.js
// Defines the pool of mini-challenges used by sim.js

window.MINI_CHALLENGES = [
  {
    id: "assessment",
    name: "Assessment Challenge",
    weights: {
      comedy: 0.25,
      improv: 0.30,
      acting: 0.20,
      runway: 0.15,
      dance:  0.05,
      singing:0.05
    },
    variance: 1.5
  },
  {
    id: "choreography",
    name: "Choreography Challenge",
    weights: {
      dance:  0.50,
      improv: 0.20,
      runway: 0.15,
      singing:0.15
    },
    variance: 1.8
  },
  {
    id: "commercial",
    name: "Commercial Challenge",
    weights: {
      acting: 0.40,
      comedy: 0.35,
      improv: 0.15,
      runway: 0.10
    },
    variance: 1.8
  },
  {
    id: "design_mini",
    name: "Design Challenge",
    weights: {
      // Mini version of the main design challenge: make a quick look & sell it
      design: 0.60,
      runway: 0.20,
      improv: 0.10,
      acting: 0.10
    },
    variance: 1.8
  },
  {
    id: "puppets",
    name: "Everybody Loves Puppets",
    weights: {
      comedy: 0.50,
      improv: 0.30,
      acting: 0.20
    },
    variance: 1.6
  },
  {
    id: "guessing",
    name: "Guessing Challenge",
    weights: {
      improv: 0.40,
      comedy: 0.30,
      acting: 0.20,
      runway: 0.10
    },
    variance: 1.5
  },
  {
    id: "improvisation",
    name: "Improvisation Challenge",
    weights: {
      improv: 0.50,
      acting: 0.30,
      comedy: 0.20
    },
    variance: 1.8
  },
  {
    id: "lip_sync_mini",
    name: "Lip Sync Challenge",
    weights: {
      lipsync: 0.55,
      dance:   0.20,
      improv:  0.15,
      singing: 0.10
    },
    variance: 2.0
  },
  {
    id: "makeover_mini",
    name: "Makeover Challenge",
    weights: {
      // Quick transformations: half styling, half construction
      runway: 0.35,
      design: 0.25,
      improv: 0.15,
      acting: 0.15,
      comedy: 0.10
    },
    variance: 1.8
  },
  {
    id: "photoshoot",
    name: "Photoshoot Challenge",
    weights: {
      // Look still matters, but it's about posing & presence too
      runway: 0.40,
      design: 0.15,
      improv: 0.15,
      comedy: 0.20,
      acting: 0.10
    },
    variance: 1.5
  },
  {
    id: "physical",
    name: "Physical Challenge",
    weights: {
      dance:  0.40,
      improv: 0.20,
      acting: 0.20,
      runway: 0.20
    },
    variance: 1.9
  },
  {
    id: "reading",
    name: "Reading Challenge",
    weights: {
      comedy: 0.55,
      improv: 0.30,
      acting: 0.15
    },
    variance: 1.7
  },
  {
    id: "runway_mini",
    name: "Runway Challenge",
    weights: {
      // Mostly about serving runway, but a bit of credit for self-made looks
      runway: 0.55,
      design: 0.15,
      improv: 0.15,
      acting: 0.15
    },
    variance: 1.6
  },
  {
    id: "singing_mini",
    name: "Singing Challenge",
    weights: {
      singing: 0.50,
      dance:   0.25,
      improv:  0.15,
      acting:  0.10
    },
    variance: 1.9
  },
  {
    id: "trivia",
    name: "Trivia Challenge",
    weights: {
      improv: 0.45,
      comedy: 0.25,
      acting: 0.20,
      runway: 0.10
    },
    variance: 1.5
  }
];
