// mini-challenges.js
// Defines the pool of mini-challenges used by sim.js

window.MINI_CHALLENGES = [
  {
    id: "assessment",
    name: "Assessment Challenge",
    weights: {
      comedy: 0.25,
      improv: 0.3,
      acting: 0.2,
      runway: 0.15,
      dance: 0.05,
      singing: 0.05
    },
    variance: 1.5
  },
  {
    id: "choreography",
    name: "Choreography Challenge",
    weights: {
      dance: 0.5,
      improv: 0.2,
      runway: 0.15,
      singing: 0.15
    },
    variance: 1.8
  },
  {
    id: "commercial",
    name: "Commercial Challenge",
    weights: {
      acting: 0.4,
      comedy: 0.35,
      improv: 0.15,
      runway: 0.1
    },
    variance: 1.8
  },
  {
    id: "design_mini",
    name: "Design Challenge",
    weights: {
      runway: 0.6,
      improv: 0.1,
      acting: 0.1,
      dance: 0.1,
      singing: 0.1
    },
    variance: 1.8
  },
  {
    id: "puppets",
    name: "Everybody Loves Puppets",
    weights: {
      comedy: 0.5,
      improv: 0.3,
      acting: 0.2
    },
    variance: 1.6
  },
  {
    id: "guessing",
    name: "Guessing Challenge",
    weights: {
      improv: 0.4,
      comedy: 0.3,
      acting: 0.2,
      runway: 0.1
    },
    variance: 1.5
  },
  {
    id: "improvisation",
    name: "Improvisation Challenge",
    weights: {
      improv: 0.5,
      acting: 0.3,
      comedy: 0.2
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
      runway: 0.5,
      improv: 0.2,
      acting: 0.15,
      comedy: 0.15
    },
    variance: 1.8
  },
  {
    id: "photoshoot",
    name: "Photoshoot Challenge",
    weights: {
      runway: 0.5,
      improv: 0.2,
      comedy: 0.2,
      acting: 0.1
    },
    variance: 1.5
  },
  {
    id: "physical",
    name: "Physical Challenge",
    weights: {
      dance: 0.4,
      improv: 0.2,
      acting: 0.2,
      runway: 0.2
    },
    variance: 1.9
  },
  {
    id: "reading",
    name: "Reading Challenge",
    weights: {
      comedy: 0.55,
      improv: 0.3,
      acting: 0.15
    },
    variance: 1.7
  },
  {
    id: "runway_mini",
    name: "Runway Challenge",
    weights: {
      runway: 0.65,
      improv: 0.2,
      acting: 0.15
    },
    variance: 1.6
  },
  {
    id: "singing_mini",
    name: "Singing Challenge",
    weights: {
      singing: 0.5,
      dance: 0.25,
      improv: 0.15,
      acting: 0.1
    },
    variance: 1.9
  },
  {
    id: "trivia",
    name: "Trivia Challenge",
    weights: {
      improv: 0.45,
      comedy: 0.25,
      acting: 0.2,
      runway: 0.1
    },
    variance: 1.5
  }
];
