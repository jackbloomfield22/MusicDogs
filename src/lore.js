// The world of MusicDogs: the Chorus Isles, the dogs who live there, their
// stories and quests, plus the catalogue for the (pretend) store.
// Pure data, so the rules and the tests can read it without any 3D or DOM.

export const WORLD_NAME = 'The Chorus Isles';

/**
 * need  – fame stars required before the cloud-ferry will take you there
 * mult  – how much better a crowd pays here than on the porch at home
 * sky   – [top, upper, lower, horizon] colours
 */
export const PLACES = [
  {
    id: 'home', name: "Pup's Porch", kind: 'Home', family: null, need: 0, mult: 1,
    venue: 'the porch', npc: null, map: [50, 78],
    sky: ['#58B4FF', '#A8DCFF', '#FFE8C9', '#FFD1B8'], ground: null, accent: '#3FA7FF',
    blurb: 'A sunny practice stage adrift on the cloud sea. Bowl, bed, bath and a tip jar: everything a growing MusicDog needs.',
  },
  {
    id: 'drum', name: 'Drumlin Hollow', kind: 'Isle of Percussion', family: 'perc', need: 0, mult: 1.25,
    venue: 'the Thunder Ring', npc: 'boomer', map: [22, 58],
    sky: ['#4B3FB5', '#E9825A', '#FFC56E', '#FFE2A0'], ground: '#B98F6C', accent: '#FF6B7A',
    blurb: 'A canyon of standing stones where every footstep booms. The stage itself is a drumhead as wide as a pond.',
  },
  {
    id: 'string', name: 'Stringmeadow', kind: 'Isle of Strings', family: 'str', need: 2, mult: 1.4,
    venue: 'the Willow Bandstand', npc: 'viola', map: [76, 54],
    sky: ['#43B9F2', '#AEE8F5', '#E4F7CC', '#CDEFA0'], ground: '#86CF63', accent: '#FFB84D',
    blurb: 'Rolling grass under harp-willows whose branches hang like strings. The wind plays them whenever it passes.',
  },
  {
    id: 'reed', name: 'Reedwater', kind: 'Isle of Woodwinds', family: 'wood', need: 4, mult: 1.55,
    venue: 'the Lily Pad Stage', npc: 'pip', map: [30, 30],
    sky: ['#2B8785', '#7ACFBE', '#D3F2E1', '#F1FBE6'], ground: '#5DB5A2', accent: '#6FD08A',
    blurb: 'A misty marsh of hollow reeds. Breathe out anywhere on Reedwater and something whistles back.',
  },
  {
    id: 'brass', name: 'Port Brass', kind: 'Isle of Brass', family: 'brass', need: 6, mult: 1.7,
    venue: 'the Foghorn Pier', npc: 'tuba', map: [72, 24],
    sky: ['#3A66D4', '#8DB4FF', '#FFD79C', '#FFB466'], ground: '#D6AE82', accent: '#FFD23F',
    blurb: 'A harbour for cloud-ferries, watched over by a lighthouse with a horn for a lamp. You can hear it from every isle.',
  },
  {
    id: 'shell', name: 'The Grand Shell', kind: 'Heart of the Isles', family: null, need: 9, mult: 2,
    venue: 'the Grand Shell', npc: 'fermata', map: [50, 8],
    sky: ['#1A1361', '#5A3FC0', '#C76BD6', '#FFB3C7'], ground: '#F1EADF', accent: '#B48CFF',
    blurb: 'A marble band shell built to gather all four Echoes under one roof. It has waited a long time for someone to fill it.',
  },
];
export const placeById = (id) => PLACES.find((p) => p.id === id) || PLACES[0];

/** Fame stars at a venue come from applause: 2, 6 and 12 points. */
export const FAME_STEPS = [2, 6, 12];

export const NPCS = {
  boomer: {
    name: 'Boomer', title: 'Keeper of the Beat', place: 'drum', coat: 'cocoa', levels: { perc: 3, str: 0, wood: 0, brass: 0 }, pitch: 0.85,
    about: 'A broad old dog with a drum for a belly and a laugh you feel in your paws. He has kept time for Drumlin Hollow since before the Quiet Year.',
    intro: [
      'BOOM! Ha! Felt that in your ribs, did you? Welcome to Drumlin Hollow, little one.',
      'Every MusicDog starts as half a song. You look after a pup, the pup grows the rest. That is how it has always worked.',
      'The Thunder Ring has been short of new players for years. Step up and let the stones hear you.',
    ],
    idle: ['Keep your paws loose. The beat does the work.', 'The stones remember every rhythm played here. They are very good listeners.', 'Hungry pups rush. Rested pups groove. Remember that.'],
  },
  viola: {
    name: 'Viola', title: 'Weaver of the Willow', place: 'string', coat: 'snow', levels: { perc: 0, str: 3, wood: 0, brass: 0 }, pitch: 1.35,
    about: 'Tall, calm and silver-eared, with a harp rising from her back. She tunes the willows every morning before the dew is gone.',
    intro: [
      'Oh, hello. Mind the branches, they are freshly tuned.',
      'Strings only sing when they are cared for. A slack string sulks. So does a pup, I have noticed.',
      'The Willow Bandstand is yours whenever you like. I will play along, if you do not mind a duet.',
    ],
    idle: ['Listen. That is the wind practising its scales.', 'A melody is only a walk. You go out, you see something lovely, you come home.', 'When all is well with a pup, you can hear it. We call that being in harmony.'],
  },
  pip: {
    name: 'Pip', title: 'Whistler of the Marsh', place: 'reed', coat: 'biscuit', levels: { perc: 0, str: 0, wood: 3, brass: 0 }, pitch: 1.7,
    about: 'Small, quick and never quiet, with a mohawk of pan-pipes. Pip knows every shortcut through the reeds and most of the gossip.',
    intro: [
      'Psst! Over here! No, HERE. Hi! I am Pip. You are new. I love new.',
      'Have you seen the golden notes? They drift over from the Grand Shell. Old Maestra says they are bits of the Great Howl looking for a home.',
      'Catch them when you can. And play us something! The frogs have been asking.',
    ],
    idle: ['I whistled for a whole day once. The reeds asked me to stop.', 'Golden notes like a pup who is paying attention.', 'Captain Tuba pretends to be grumpy. He is not. Do not tell him I said so.'],
  },
  tuba: {
    name: 'Captain Tuba', title: 'Harbourmaster', place: 'brass', coat: 'midnight', levels: { perc: 0, str: 0, wood: 0, brass: 3 }, pitch: 0.7,
    about: 'A barrel-chested sea dog wrapped in a sousaphone. He sounds the foghorn at dusk so the cloud-ferries can find their way home.',
    intro: [
      'Hrmph. Another pup with stars in its eyes. Well. The pier is sturdy and the crowd is honest.',
      'A busker earns a living one tip at a time. Mind your jar, empty it often, and it will look after you.',
      'Go on, then. Give the harbour a tune. I may hum along. Quietly.',
    ],
    idle: ['Fair skies today. Good day for a fanfare.', 'I have seen a hundred pups pass through. The ones who last are the ones who are loved.', 'The Grand Shell is straight up from here. You will know when you are ready.'],
  },
  fermata: {
    name: 'Maestra Fermata', title: 'Conductor of the Grand Shell', place: 'shell', coat: 'midnight', levels: { perc: 3, str: 3, wood: 3, brass: 3 }, pitch: 1.0,
    about: 'The last dog to carry all four Echoes. She has kept the Grand Shell swept and its lamps lit, waiting for the next one.',
    intro: [
      'So. You are the pup the isles have been whispering about.',
      'Long ago the Great Howl broke into four Echoes, and we have been four separate songs ever since. I am the last who can sing them all, and my voice is not what it was.',
      'This hall was built for a Full Orchestra. Grow, little one. Then come and fill it.',
    ],
    idle: ['A fermata means: hold this note as long as it deserves.', 'Every isle has given you something. I can hear all of them in you.', 'Applause is lovely. Being listened to is better.'],
  },
};

/**
 * Three quests per friend, done in order. Goal types:
 *   concertsAt {place,n}  fame {place,n}  grow {family,tier}  full
 *   harmony {n}  golden {n}  jar {n}  pets {n}
 */
export const QUESTS = {
  boomer: [
    { ask: 'Play two concerts here in the Thunder Ring. Let the stones learn your name.', label: 'Play 2 concerts at Drumlin Hollow', goal: { type: 'concertsAt', place: 'drum', n: 2 }, done: 'Ha! They are still humming it. Here, and let me tell you about the four Echoes.', reward: { notes: 60, gems: 5, legend: 'echoes' } },
    { ask: 'Now grow a bit of percussion of your own. Any part will do. A band needs a heartbeat.', label: 'Grow any Percussion part', goal: { type: 'grow', family: 'perc', tier: 1 }, done: 'There it is. Hear that thump? Take this for your porch.', reward: { notes: 80, gems: 10, souvenir: 'bongo' } },
    { ask: 'Last thing: earn three fame stars in the Thunder Ring. I want the whole canyon stamping.', label: 'Earn 3 fame stars at Drumlin Hollow', goal: { type: 'fame', place: 'drum', n: 3 }, done: 'BOOM! That is a headliner. Drumlin Hollow is proud of you.', reward: { notes: 200, gems: 20 } },
  ],
  viola: [
    { ask: 'Play two concerts at the Willow Bandstand. I would like to hear how you phrase things.', label: 'Play 2 concerts at Stringmeadow', goal: { type: 'concertsAt', place: 'string', n: 2 }, done: 'Lovely. You listen while you play. Let me tell you about the Quiet Year.', reward: { notes: 90, gems: 5, legend: 'quiet' } },
    { ask: 'Bring your pup into harmony twice: every need comfortably full, all at once.', label: 'Reach harmony 2 times', goal: { type: 'harmony', n: 2 }, done: 'You can hear the difference, can you not? This is for your porch.', reward: { notes: 110, gems: 10, souvenir: 'windchime' } },
    { ask: 'Earn three fame stars at the bandstand, and the willows will keep your tune.', label: 'Earn 3 fame stars at Stringmeadow', goal: { type: 'fame', place: 'string', n: 3 }, done: 'The willows have it now. They will play it on windy days.', reward: { notes: 260, gems: 20 } },
  ],
  pip: [
    { ask: 'Play two concerts on the Lily Pad Stage! The frogs want an opening act. That is you. You are the act.', label: 'Play 2 concerts at Reedwater', goal: { type: 'concertsAt', place: 'reed', n: 2 }, done: 'They LOVED it. One of them cried. Okay, story time: why pups grow.', reward: { notes: 120, gems: 5, legend: 'grow' } },
    { ask: 'Catch two golden notes. They are slippery. Keep your eyes up!', label: 'Catch 2 golden notes', goal: { type: 'golden', n: 2 }, done: 'You got them! I knew you would. Here, I made you this.', reward: { notes: 140, gems: 10, souvenir: 'reeds' } },
    { ask: 'Three fame stars at the Lily Pad Stage. Then you are officially marsh-famous.', label: 'Earn 3 fame stars at Reedwater', goal: { type: 'fame', place: 'reed', n: 3 }, done: 'Marsh-famous! That is the best kind. Ask anyone here.', reward: { notes: 320, gems: 20 } },
  ],
  tuba: [
    { ask: 'Two concerts on the Foghorn Pier. Loud enough for the ferries to hear.', label: 'Play 2 concerts at Port Brass', goal: { type: 'concertsAt', place: 'brass', n: 2 }, done: 'Hrm. Not bad. Not bad at all. Sit. I will tell you what the Grand Shell is for.', reward: { notes: 150, gems: 5, legend: 'shell' } },
    { ask: 'Show me you can keep a jar. Collect 150 notes in tips.', label: 'Collect 150 notes from the tip jar', goal: { type: 'jar', n: 150 }, done: 'That is a working musician. Take this lantern. It has seen a few harbours.', reward: { notes: 170, gems: 10, souvenir: 'lantern' } },
    { ask: 'Three fame stars on the pier, and I will sound the foghorn in your honour.', label: 'Earn 3 fame stars at Port Brass', goal: { type: 'fame', place: 'brass', n: 3 }, done: 'HOOOOONK. There. Do not make a fuss about it.', reward: { notes: 380, gems: 20 } },
  ],
  fermata: [
    { ask: 'Grow all twelve parts. Become a Full Orchestra. I will be here.', label: 'Become a Full Orchestra', goal: { type: 'full' }, done: 'All four Echoes in one small dog. I had almost stopped hoping.', reward: { notes: 300, gems: 25 } },
    { ask: 'Now play three concerts in the Grand Shell. Let the hall remember what it was built for.', label: 'Play 3 concerts at the Grand Shell', goal: { type: 'concertsAt', place: 'shell', n: 3 }, done: 'Did you hear the walls answer? They have not done that in my lifetime.', reward: { notes: 400, gems: 25, souvenir: 'baton' } },
    { ask: 'Three fame stars here, and the isles will sing the Great Howl together again.', label: 'Earn 3 fame stars at the Grand Shell', goal: { type: 'fame', place: 'shell', n: 3 }, done: 'There it is. The whole Howl, from one end of the sky to the other. Wear this. You have earned it.', reward: { notes: 600, gems: 50, cosmetic: 'crown', legend: 'again' } },
  ],
};

export const LEGENDS = [
  { id: 'howl', title: 'The Great Howl', text: 'Before there were isles there was one long note. The first dog sang it at the first moon, and it was so full that the sky could not hold it. That note was the Great Howl, and every song since is a piece of it.' },
  { id: 'echoes', title: 'The Four Echoes', text: 'When the Great Howl broke, it broke four ways. The heartbeat fell on Drumlin Hollow. The sigh of the wind settled in Stringmeadow. The breath went to Reedwater, and the shout of the sun landed on Port Brass. Each Echo soaked into the dogs who lived there. That is why a pup of the isles is always born half instrument.' },
  { id: 'quiet', title: 'The Quiet Year', text: 'There was a year when the isles stopped playing together. Nobody remembers who stopped first. The clouds between them thickened, the ferries stayed in harbour, and each isle kept its own Echo to itself. Dogs still call a long silence "a quiet year".' },
  { id: 'grow', title: 'Why Pups Grow', text: 'A MusicDog grows the Echo it hears. A pup that is fed, washed, rested and played with has room to listen, and what it listens to, it becomes. Nobody has ever grown an instrument by wanting one. It has always taken somebody caring.' },
  { id: 'shell', title: 'The Grand Shell', text: 'After the Quiet Year the isles built a hall at the very top of the sky, shaped like a seashell so that it would hold sound the way a shell holds the sea. It was made for one thing: a single dog carrying all four Echoes, singing them back into one.' },
  { id: 'again', title: 'The Howl, Again', text: 'On the night a small dog filled the Grand Shell, every isle heard the same note at the same moment. The willows rang, the reeds whistled, the stones boomed and the foghorn answered. It was not the first Great Howl. It was a new one, and it had your pup\'s name in it.' },
];

export const SOUVENIRS = {
  bongo: { name: 'Pocket Bongo', from: 'Boomer' },
  windchime: { name: 'Willow Wind-Chime', from: 'Viola' },
  reeds: { name: 'Jar of Singing Reeds', from: 'Pip' },
  lantern: { name: 'Harbour Lantern', from: 'Captain Tuba' },
  baton: { name: "Maestra's Golden Baton", from: 'Maestra Fermata' },
};

// --------------------------------------------------------------- the store
// Everything below is a PRETEND store for trying out the economy.
// No payment is ever taken; "prices" are labels only.

export const GEM_PACKS = [
  { sku: 'welcome', name: 'Welcome Bundle', price: 1.99, gems: 200, notes: 300, cosmetic: 'partyhat', once: true, tag: 'One time', blurb: '200 gems, 300 notes and a Party Hat.' },
  { sku: 'gems80', name: 'Pouch of Gems', price: 0.99, gems: 80, blurb: '80 gems. A little sparkle.' },
  { sku: 'gems500', name: 'Bag of Gems', price: 4.99, gems: 500, tag: 'Popular', blurb: '500 gems. Plenty for outfits and boosts.' },
  { sku: 'gems1200', name: 'Chest of Gems', price: 9.99, gems: 1200, tag: 'Best value', blurb: '1200 gems. The most gems per pretend dollar.' },
  { sku: 'gems2800', name: 'Vault of Gems', price: 19.99, gems: 2800, blurb: '2800 gems. For the pup who has everything.' },
];

export const BOOSTS = [
  { id: 'hamper', name: 'Snack Hamper', cost: 25, blurb: 'Fills every need to the top, right now.' },
  { id: 'magnet', name: 'Tip Magnet', cost: 30, blurb: 'Doubles the tip jar for 10 minutes.' },
  { id: 'ticket', name: 'Encore Ticket', cost: 40, blurb: 'Your next concert ends in a standing ovation at least.' },
  { id: 'sack', name: 'Sack of Notes', cost: 50, blurb: 'A sack of notes sized to your orchestra.' },
  { id: 'jumbo', name: 'Jumbo Jar', cost: 150, once: true, blurb: 'A tip jar that holds twice as much. Yours to keep.' },
];

export const COSMETICS = [
  { id: 'partyhat', name: 'Party Hat', slot: 'head', cost: 60 },
  { id: 'bowtie', name: 'Bow Tie', slot: 'neck', cost: 80 },
  { id: 'tophat', name: 'Top Hat', slot: 'head', cost: 120 },
  { id: 'shades', name: 'Star Shades', slot: 'face', cost: 150 },
  { id: 'crown', name: 'Golden Crown', slot: 'head', cost: null, from: 'A gift from Maestra Fermata' },
];
export const cosmeticById = (id) => COSMETICS.find((c) => c.id === id);

/** Small daily to-dos. Three are picked each day. */
export const TASKS = [
  { type: 'concerts', n: 2, label: 'Play 2 concerts' },
  { type: 'concerts', n: 3, label: 'Play 3 concerts' },
  { type: 'jarCollects', n: 2, label: 'Empty the tip jar 2 times' },
  { type: 'pets', n: 10, label: 'Stroke your pup 10 times' },
  { type: 'golden', n: 1, label: 'Catch a golden note' },
  { type: 'harmony', n: 1, label: 'Bring your pup into harmony' },
  { type: 'travels', n: 1, label: 'Visit another isle' },
  { type: 'care', n: 3, label: 'Feed, wash or play 3 times' },
];
export const TASK_GEMS = 3;
export const TASK_BONUS = 5;
