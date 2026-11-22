// =====================================================
//  LAST EMBER — config (tune the game here)
// =====================================================
const CONFIG = {
  VERSION: '1.1',
  WORLD: 3400,              // world is WORLD x WORLD px, bonfire at centre
  TREE_COUNT: 520,
  ROOM_PREFIX: 'lastember-', // PeerJS id prefix for online rooms

  // Put your own PNGs in /img and they will be used automatically.
  // If a file is missing, the procedural (drawn) version is used.
  IMAGES: {
    monster: 'img/monster.png',   // used for every type that has no own image (~128x128, transparent, facing right)
    monster_crawler: 'img/monster_crawler.png',
    monster_weeper:  'img/monster_weeper.png',
    monster_wendigo: 'img/monster_wendigo.png',
    monster_mimic:   'img/monster_mimic.png',
    monster_watcher: 'img/monster_watcher.png',
    player:  '',                  // e.g. 'img/player.png' (optional)
  },
  MONSTER_IMG_SIZE: 92,            // multiplied by each type's size (js/monsters.js)
  BUBBLE_TIME: 5,                  // seconds a chat bubble stays above a head

  PLAYER: {
    walk: 125, sprint: 205, radius: 13,
    staminaMax: 100, staminaDrain: 30, staminaRegen: 16,
    vision: 105,          // personal vision in darkness
    torchVision: 270,     // vision while holding a lit torch
    torchBurn: 45,        // seconds one wood burns as a torch
  },

  MODES: {
    normal: {
      label: 'Normal',
      materialsNeeded: 8,
      fuelMax: 100, burnPerSec: 0.62, woodFuel: 24,
      woodTarget: [11, 22],          // wood on the ground (start → end of progress)
      woodRespawn: 7,                // seconds
      monsters: [2, 6],              // count (start → end of progress)
      monsterSpeed: [135, 165],      // hunting speed
      roamSpeed: 68,
      sight: 175, torchSight: 470, sprintHear: 330, walkHear: 70,
      reviveWindow: 60, reviveTime: 3,
      alertRadius: 0, memory: false,
      eventEvery: [28, 50],
    },
    hard: {
      label: 'Hard',
      materialsNeeded: 10,
      fuelMax: 100, burnPerSec: 0.8, woodFuel: 19,
      woodInitial: 16,               // strict: limited pool
      woodTarget: [5, 7],
      woodRespawn: 40,
      monsters: [3, 9],
      monsterSpeed: [158, 192],
      roamSpeed: 78,
      sight: 200, torchSight: 540, sprintHear: 420, walkHear: 85,
      reviveWindow: 0, reviveTime: 0,
      alertRadius: 750, memory: true,
      eventEvery: [18, 34],
    }
  },

  FIRE: { minRadius: 70, maxRadius: 310, warnAt: 0.2 },

  MATERIALS: [
    { id: 'engine',     name: 'Engine',      icon: '⚙️' },
    { id: 'battery',    name: 'Car Battery', icon: '🔋' },
    { id: 'gas',        name: 'Gasoline',    icon: '⛽' },
    { id: 'tire',       name: 'Tire',        icon: '🛞' },
    { id: 'radiator',   name: 'Radiator',    icon: '🌡️' },
    { id: 'spark',      name: 'Spark Plug',  icon: '⚡' },
    { id: 'key',        name: 'Car Key',     icon: '🔑' },
    { id: 'kit',        name: 'Repair Kit',  icon: '🧰' },
    { id: 'alternator', name: 'Alternator',  icon: '🔌' },
    { id: 'hose',       name: 'Fuel Hose',   icon: '➰' },
  ],

  ENDINGS: {
    worst: { title: 'GAME OVER – EVERYONE LOST', tag: 'Worst Ending',
      text: 'The next morning, police discovered several corpses scattered throughout the forest. The vehicle was never found.' },
    bad:   { title: 'BAD ENDING – SOMEONE WAS LEFT BEHIND', tag: 'Bad Ending',
      text: 'The survivors made it home. But the silence was unbearable. One by one, they disappeared from the world, leaving behind nothing but unanswered questions.' },
    good:  { title: 'GOOD ENDING – EVERYONE SURVIVED', tag: 'Good Ending',
      text: 'At sunrise, the vehicle finally escaped the forest. Everyone was alive. But something was watching them from the trees.' },
  },

  PLAYER_COLORS: ['#ffcc33', '#33d1ff', '#ff4fd8', '#6dff5a'], // bright so teammates stand out from the forest
  FAKE_LINES: ['I am here', 'over here...', 'come to me', 'I found something, follow me', 'help', 'why did you leave me', 'behind you', 'I\'m by the trees'],
  WHISPERS: ['...behind you...', '...it sees you...', '...don\'t look back...', '...stay with us...', '...the fire is dying...'],
};
