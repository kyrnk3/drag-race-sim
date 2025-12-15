// challenges.js
window.CHALLENGES = [
  {
    id: "design",
    name: "Design Challenge",
    weights: {
      // Main focus: actually making looks
      design: 0.6,
      // Still about how it walks/presents on the runway
      runway: 0.2,
      // A bit of performance / selling the fantasy
      improv: 0.1,
      acting: 0.1
    },
    variance: 2.0
  },
  {
    id: "acting",
    name: "Acting Challenge",
    weights: {
      acting: 0.6,
      improv: 0.2,
      runway: 0.2
    },
    variance: 2.0
  },
  {
    id: "ball",
    name: "Ball",
    weights: {
      // Still very runway-focused overall...
      runway: 0.35,
      // ...but the designed third look matters *a lot*
      design: 0.45,
      acting: 0.05,
      dance: 0.05,
      improv: 0.05,
      comedy: 0.05
    },
    variance: 2.0
  },
  {
    id: "advert",
    name: "Advert / Branding Challenge",
    weights: {
      comedy: 0.35,
      acting: 0.25,
      improv: 0.25,
      runway: 0.15
    },
    variance: 2.2
  },
  {
    id: "makeover",
    name: "Makeover Challenge",
    weights: {
      runway: 0.6,
      acting: 0.15,
      improv: 0.15,
      comedy: 0.1
    },
    variance: 2.0
  },
  {
    id: "snatch_game",
    name: "Snatch Game",
    weights: {
      comedy: 0.7,
      improv: 0.2,
      runway: 0.1
    },
    variance: 2.5
  },
  {
    id: "improv",
    name: "Improv Challenge",
    weights: {
      improv: 0.6,
      comedy: 0.25,
      acting: 0.15
    },
    variance: 2.5
  },
  {
    id: "rusical",
    name: "Rusical",
    weights: {
      singing: 0.4,
      dance: 0.3,
      acting: 0.3
    },
    variance: 2.3
  },
  {
    id: "rumix",
    name: "Rumix / Music Video",
    weights: {
      dance: 0.4,
      singing: 0.25,
      improv: 0.2,
      runway: 0.15
    },
    variance: 2.2
  },
  {
    id: "standup",
    name: "Standup Comedy",
    weights: {
      comedy: 0.6,
      improv: 0.25,
      acting: 0.15
    },
    variance: 2.5
  },
  {
    id: "choreo",
    name: "Choreo Challenge",
    weights: {
      dance: 0.6,
      improv: 0.2,
      runway: 0.2
    },
    variance: 1.8
  },
  {
    id: "singing",
    name: "Singing / Vocal Challenge",
    weights: {
      singing: 0.6,
      dance: 0.2,
      acting: 0.2
    },
    variance: 2.0
  },
  {
    id: "girl_groups",
    name: "Girl Groups",
    weights: {
      dance: 0.35,
      singing: 0.35,
      improv: 0.2,
      runway: 0.1
    },
    variance: 2.3
  },
  {
    id: "roast",
    name: "Roast",
    weights: {
      comedy: 0.6,
      improv: 0.3,
      runway: 0.1
    },
    variance: 2.5
  },
  {
    id: "lipsync",
    name: "Lipsync Challenge",
    weights: {
      lipsync: 0.60,
      dance:   0.20,
      improv:  0.10,
      acting:  0.10
    },
    variance: 2.3
  },
  {
    id: "runway",
    name: "Runway Showcase",
    weights: {
      runway: 0.7,
      improv: 0.1,
      acting: 0.1,
      // Small but real: queens who build their own garments
      design: 0.1
    },
    variance: 1.5
  }
];
