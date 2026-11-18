/* Jeune preview site: settings shared by every page.
   Everything the founders may want to change lives here. */

const CONFIG = {
  brand: "Jeune",          // placeholder: change here when the name is settled
  deposit: 20,             // refundable pre-order deposit, in dollars
  items: {
    "kit":               { name: "The Cycle Kit",       price: 120, img: "images/trio.jpg",      meta: "56 pouches · 28-day cycle" },
    "essential-pouch":   { name: "The Essential Blend", price: 49,  img: "images/essential.jpg", meta: "28 liposomal pouches" },
    "essential-capsule": { name: "The Essential Blend", price: 49,  img: "images/essential.jpg", meta: "30 capsules" }
  },
  // Blend days follow the pitch deck: 1-5, 6-11, 12 to the end of the cycle.
  phases: {
    menstrual:  { name: "Menstrual",  color: "var(--menstrual)",  endDay: () => 5,
                  tagline: "Soothe + Replenish",
                  blurb: "Soothing botanicals and iron-rich nutrients to help you rest, restore and reset." },
    follicular: { name: "Follicular", color: "var(--follicular)", endDay: () => 11,
                  tagline: "Energize + Renew",
                  blurb: "Support for energy, mental clarity and a healthy metabolism." },
    luteal:     { name: "Luteal",     color: "var(--luteal)",     endDay: (len) => len,
                  tagline: "Calm + Balance",
                  blurb: "Mood support, comfort from bloating and adaptogens to help you feel steady." }
  },
  minCycle: 21,
  maxCycle: 35,
  defaultCycle: 28
};
