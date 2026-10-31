// Category and item templates. Quantities and costs are computed at runtime
// in app.js based on household size, duration, space, diet, cuisine and
// cooking/power answers.
// Guidance basis: UK Government "Prepare" household emergency guidance
// (water, food, warmth/light, power, first aid, documents, pets).
//
// Costs are rough UK high-street planning estimates (GBP), not live prices —
// use the "Search Amazon" / "Find near me" links on each item to check
// actual current prices. An item with cost: null is excluded from totals
// (e.g. cash reserve isn't a "purchase", medication cost is unpredictable).

// Essentials are always shown regardless of space (a kit missing an essential
// isn't a smaller kit, it's a broken one). These limits cap how many
// *optional* extras get added on top, per category, at the "comfortable" tier.
const SPACE_LIMITS = {
  tiny: 0,
  small: 3,
  medium: 6,
  large: Infinity
};

const CATEGORIES = [
  {
    id: 'water',
    title: 'Water',
    note: 'Gov guidance: at least 3 litres of drinking water per person per day (more in hot weather or for pregnant/breastfeeding people).',
    items: [
      {
        name: 'Bottled drinking water',
        qty: (h) => `${h.people * h.duration * 3} litres`,
        cost: (h) => h.people * h.duration * 3 * 0.45,
        essential: true
      },
      { name: 'Water purification tablets or a filter bottle', qty: () => 'one pack / one bottle', cost: () => 15, essential: true },
      { name: 'Large refillable water container (for topping up from a tanker/standpipe)', qty: () => '1 (10–20L)', cost: () => 10, essential: false }
    ]
  },
  {
    id: 'food',
    title: 'Food',
    note: 'High-calorie, long-life, minimal-prep food. Staples below are matched to the cuisine you chose; ration packs are a backup, not the main plan — familiar food gets eaten, especially by kids.',
    items: [
      // General base (always included, any cuisine)
      { name: 'Tinned food (beans, soup, fish, fruit) with ring-pull lids', qty: (h) => `${h.people * h.duration} tins`, cost: (h) => h.people * h.duration * 1, essential: true },
      { name: 'Manual tin opener', qty: () => '1', cost: () => 3, essential: true },
      { name: 'UHT milk or milk alternative', qty: (h) => `${h.people} cartons`, cost: (h) => h.people * 1.2, essential: false, climateSensitive: true },
      {
        name: 'Ready-to-eat high-calorie meals (military/expedition-style ration packs)',
        qty: (h) => `${h.people * h.duration} meals (backup only — see staples above for everyday meals)`,
        cost: (h) => h.people * h.duration * 6,
        essential: false
      },
      {
        name: 'Infant formula / baby food (if applicable)',
        qty: (h) => h.diet.includes('infant-formula') ? `${h.duration} days supply` : null,
        cost: (h) => h.duration * 10,
        essential: true,
        climateSensitive: true
      },
      {
        name: 'Familiar comfort snacks/treats for children (biscuits, something they already like)',
        qty: (h) => h.children > 0 ? `${h.children} supply` : null,
        cost: (h) => h.children * 5,
        essential: false,
        showIf: (h) => h.children > 0,
        climateSensitive: true
      },

      // General / Western staples
      { name: 'Long-life snacks (nuts, dried fruit, energy bars)', qty: (h) => `${h.people * h.duration} portions`, cost: (h) => h.people * h.duration * 0.6, essential: false, showIf: (h) => h.cuisine === 'general' },
      { name: 'Pasta or rice + jarred sauce', qty: (h) => `${h.people} meals worth`, cost: (h) => h.people * 3, essential: false, showIf: (h) => h.cuisine === 'general' },
      { name: 'Crackers / crispbread', qty: (h) => `${h.people} packs`, cost: (h) => h.people * 1.5, essential: false, showIf: (h) => h.cuisine === 'general' },

      // South Asian staples
      { id: 'rice-south-asian', name: 'Rice (dry, long-life)', qty: (h) => `enough for ${h.duration} days`, cost: () => 5, essential: true, showIf: (h) => h.cuisine === 'south-asian' },
      { name: 'Dried lentils/daal (chana, masoor, moong)', qty: (h) => `${h.duration} days worth`, cost: () => 4, essential: true, showIf: (h) => h.cuisine === 'south-asian' },
      { name: 'Chapati/roti flour (atta) — no-cook flatbread not possible, but usable once stove is set up', qty: () => '1 bag', cost: () => 3, essential: false, showIf: (h) => h.cuisine === 'south-asian' },
      { name: 'Cooking oil or ghee (small bottle, long-life)', qty: () => '1', cost: () => 4, essential: true, showIf: (h) => h.cuisine === 'south-asian' },
      { name: 'Tinned curry (check halal certification if needed)', qty: (h) => `${h.people * h.duration} tins`, cost: (h) => h.people * h.duration * 1.5, essential: false, showIf: (h) => h.cuisine === 'south-asian' },
      { name: 'Basic spices already used at home (salt, chilli, turmeric, cumin) in small travel tub', qty: () => '1 set', cost: () => 5, essential: false, showIf: (h) => h.cuisine === 'south-asian' },
      { name: 'Pickle / chutney (long shelf life, makes plain food edible)', qty: () => '1 jar', cost: () => 2, essential: false, showIf: (h) => h.cuisine === 'south-asian' },
      { name: 'Tea (loose or bags) + powdered/UHT milk', qty: () => '1 box', cost: () => 4, essential: false, showIf: (h) => h.cuisine === 'south-asian' },

      // Middle Eastern staples
      { id: 'rice-middle-eastern', name: 'Rice (dry, long-life)', qty: (h) => `enough for ${h.duration} days`, cost: () => 5, essential: true, showIf: (h) => h.cuisine === 'middle-eastern' },
      { name: 'Tinned chickpeas / fava beans (ful)', qty: (h) => `${h.people * h.duration} tins`, cost: (h) => h.people * h.duration * 1, essential: true, showIf: (h) => h.cuisine === 'middle-eastern' },
      { name: 'Dates (very high energy, no prep needed, culturally familiar)', qty: (h) => `${h.people} portions`, cost: (h) => h.people * 2, essential: true, showIf: (h) => h.cuisine === 'middle-eastern' },
      { name: 'Flatbread (long-life/frozen, or flour to make more once cooking is possible)', qty: () => '1 pack or bag', cost: () => 2, essential: false, showIf: (h) => h.cuisine === 'middle-eastern' },
      { name: 'Olive oil (small bottle)', qty: () => '1', cost: () => 5, essential: false, showIf: (h) => h.cuisine === 'middle-eastern' },
      { name: 'Tinned/jarred hummus or tahini', qty: () => '1-2', cost: () => 3, essential: false, showIf: (h) => h.cuisine === 'middle-eastern' },

      // East/Southeast Asian staples
      { id: 'rice-east-southeast-asian', name: 'Rice (dry, long-life)', qty: (h) => `enough for ${h.duration} days`, cost: () => 5, essential: true, showIf: (h) => h.cuisine === 'east-southeast-asian' },
      { name: 'Instant/dried noodles', qty: (h) => `${h.people * h.duration} packs`, cost: (h) => h.people * h.duration * 0.5, essential: true, showIf: (h) => h.cuisine === 'east-southeast-asian' },
      { name: 'Soy sauce / seasoning sachets', qty: () => '1 bottle', cost: () => 2, essential: false, showIf: (h) => h.cuisine === 'east-southeast-asian' },
      { name: 'Tinned or dried fish', qty: (h) => `${h.people * h.duration} portions`, cost: (h) => h.people * h.duration * 1.2, essential: false, showIf: (h) => h.cuisine === 'east-southeast-asian' },
      { name: 'Seaweed snacks / dried vegetables (long-life, familiar)', qty: () => '1 pack', cost: () => 2, essential: false, showIf: (h) => h.cuisine === 'east-southeast-asian' },

      // Caribbean / African staples
      { id: 'rice-caribbean-african', name: 'Rice (dry, long-life)', qty: (h) => `enough for ${h.duration} days`, cost: () => 5, essential: true, showIf: (h) => h.cuisine === 'caribbean-african' },
      { name: 'Tinned beans/peas (kidney, black-eyed, gungo)', qty: (h) => `${h.people * h.duration} tins`, cost: (h) => h.people * h.duration * 1, essential: true, showIf: (h) => h.cuisine === 'caribbean-african' },
      { name: 'Plantain flour or tinned plantain', qty: () => '1', cost: () => 2, essential: false, showIf: (h) => h.cuisine === 'caribbean-african' },
      { name: 'Tinned callaloo / stewed vegetables', qty: (h) => `${h.people} tins`, cost: (h) => h.people * 1.5, essential: false, showIf: (h) => h.cuisine === 'caribbean-african' },
      { name: 'Cooking oil (small bottle)', qty: () => '1', cost: () => 3, essential: true, showIf: (h) => h.cuisine === 'caribbean-african' }
    ]
  },
  {
    id: 'cooking',
    title: 'Cooking & heating food/water',
    note: 'If mains gas and electricity are both out, you need an independent way to boil water and heat food.',
    items: [
      {
        name: 'Camping/gas canister stove',
        qty: () => '1',
        cost: () => 25,
        essential: true,
        showIf: (h) => h.cooking === 'none' || h.cooking === 'camping-stove'
      },
      {
        name: 'Gas canisters for stove',
        // Rough planning figure: a small (~220g) canister gives ~1 hour of burn time.
        // Assume ~45 min of burner use per person per day (boiling water, heating one meal).
        qty: (h) => {
          const minutesNeeded = h.people * h.duration * 45;
          const canisters = Math.max(1, Math.ceil(minutesNeeded / 60));
          return `${canisters} small canister${canisters === 1 ? '' : 's'} (~1hr burn time each) — plan ${minutesNeeded} mins total use`;
        },
        cost: (h) => {
          const minutesNeeded = h.people * h.duration * 45;
          const canisters = Math.max(1, Math.ceil(minutesNeeded / 60));
          return canisters * 3;
        },
        essential: true,
        showIf: (h) => h.cooking === 'none' || h.cooking === 'camping-stove'
      },
      {
        name: 'Windproof lighter / waterproof matches',
        qty: () => '1',
        cost: () => 2,
        essential: true
      },
      { name: 'Charcoal/gas BBQ + fuel (if you already have one)', qty: () => 'top up fuel supply', cost: () => 10, essential: false, showIf: (h) => h.cooking === 'bbq' },
      {
        name: 'Heatproof pan suitable for camping stove',
        qty: () => '1',
        cost: () => 12,
        essential: true,
        showIf: (h) => h.cooking === 'none' || h.cooking === 'camping-stove'
      }
    ]
  },
  {
    id: 'power',
    title: 'Power & light',
    note: 'A power cut affects lighting, phone charging and (if electric) cooking.',
    items: [
      { name: 'Torches (one per person, not relying on phone)', qty: (h) => `${h.people}`, cost: (h) => h.people * 5, essential: true },
      { name: 'Spare batteries for torches', qty: (h) => `${h.people * 2}`, cost: (h) => h.people * 2 * 0.5, essential: true, climateSensitive: true },
      {
        name: 'Charging cables for every device (match your actual connectors — USB-C, Lightning, micro-USB)',
        qty: (h) => `${h.devices}`,
        cost: (h) => h.devices * 3,
        essential: true,
        showIf: (h) => h.devices > 0
      },
      {
        name: 'Power bank / battery pack for phones',
        // Planning figures: one full phone charge ≈ 15Wh. A 20,000mAh pack is ~74Wh nominal,
        // but usable output after voltage-conversion losses is roughly 60% (~44Wh) — call it
        // 3 real phone charges per pack, not the ~5 the mAh number implies.
        qty: (h) => {
          const chargesNeeded = h.devices * h.duration;
          let packs;
          if (h.solar) {
            const bufferCharges = h.devices * 1.5;
            packs = Math.max(1, Math.ceil(bufferCharges / 3));
            return `${packs} x 20,000mAh power bank${packs === 1 ? '' : 's'} (1.5-day buffer; topped up daily by solar panel below)`;
          }
          packs = Math.max(1, Math.ceil(chargesNeeded / 3));
          return `${packs} x 20,000mAh power bank${packs === 1 ? '' : 's'} (covers all ${chargesNeeded} charges with no recharging — no solar selected)`;
        },
        cost: (h) => {
          const chargesNeeded = h.devices * h.duration;
          let packs;
          if (h.solar) {
            const bufferCharges = h.devices * 1.5;
            packs = Math.max(1, Math.ceil(bufferCharges / 3));
          } else {
            packs = Math.max(1, Math.ceil(chargesNeeded / 3));
          }
          return packs * 25;
        },
        essential: true,
        climateSensitive: true,
        showIf: (h) => h.devices > 0
      },
      {
        name: 'Foldable solar panel (to recharge the power bank without mains power)',
        // A 20-30W foldable panel in reasonable UK daylight will fully recharge one
        // 20,000mAh pack in roughly 5-6 hours of direct sun.
        qty: (h) => {
          const panels = h.devices > 6 ? 2 : 1;
          return `${panels} x 20-30W foldable solar panel${panels === 1 ? '' : 's'} (recharges one power bank in ~5-6 hrs direct sun — cloudy days will be slower, keep the buffer pack above as backup)`;
        },
        cost: (h) => (h.devices > 6 ? 2 : 1) * 35,
        essential: true,
        showIf: (h) => h.solar && h.devices > 0
      },
      { name: 'Battery or crank-powered radio (for emergency broadcasts)', qty: () => '1', cost: () => 20, essential: true },
      { name: 'Candles + holders (use with care, ventilation)', qty: () => 'small supply', cost: () => 5, essential: false }
    ]
  },
  {
    id: 'warmth',
    title: 'Warmth',
    note: 'Especially important if a disruption happens in winter.',
    items: [
      { name: 'Warm blankets or sleeping bags', qty: (h) => `${h.people}`, cost: (h) => h.people * 15, essential: true },
      { name: 'Foil emergency blankets (compact backup)', qty: (h) => `${h.people}`, cost: (h) => h.people * 1.5, essential: false },
      { name: 'Warm clothing set kept aside (hat, gloves, thick socks)', qty: (h) => `${h.people} sets`, cost: (h) => h.people * 10, essential: false }
    ]
  },
  {
    id: 'health',
    title: 'Health & hygiene',
    note: 'Cover regular medication, basic first aid and hygiene without running water.',
    items: [
      { name: 'First aid kit', qty: () => '1', cost: () => 15, essential: true, climateSensitive: true },
      {
        name: 'Regular prescription medication (ask GP/pharmacist about a few days\' buffer)',
        qty: (h) => `${h.duration}+ days supply per person`,
        cost: () => null,
        essential: true,
        climateSensitive: true
      },
      { name: 'Hand sanitiser', qty: () => '1-2 bottles', cost: () => 3, essential: true },
      { name: 'Wet wipes', qty: (h) => `${h.people} packs`, cost: (h) => h.people * 1.5, essential: true },
      { name: 'Bin bags (for waste if bins aren\'t collected)', qty: () => '1 roll', cost: () => 2, essential: false },
      { name: 'Face masks', qty: (h) => `${h.people} packs`, cost: (h) => h.people * 3, essential: false },
      {
        name: 'Cool bag or ice packs (if anyone takes refrigerated medication, e.g. insulin)',
        qty: () => '1',
        cost: () => 10,
        essential: false
      },
      {
        name: 'Bucket with sealable lid + bin bags (emergency toilet if water/sewage is disrupted)',
        qty: () => '1',
        cost: () => 8,
        essential: false
      }
    ]
  },
  {
    id: 'documents',
    title: 'Documents & money',
    note: 'Card payment systems and cash machines can go down in a disruption.',
    items: [
      { name: 'Copies of key documents (ID, insurance, prescriptions) in a waterproof pouch', qty: () => '1 set', cost: () => 5, essential: true },
      { name: 'Some cash (small notes/coins)', qty: () => 'a reasonable reserve for your household', cost: () => null, essential: true },
      { name: 'List of emergency contacts (written, not just on phone)', qty: () => '1', cost: () => 0, essential: true }
    ]
  },
  {
    id: 'children',
    title: 'For young children',
    note: null,
    showIf: (h) => h.children > 0,
    items: [
      { name: 'Nappies', qty: (h) => `${h.children * h.duration * 6} (approx)`, cost: (h) => h.children * h.duration * 6 * 0.15, essential: true },
      { name: 'Baby wipes', qty: (h) => `${h.children} packs`, cost: (h) => h.children * 1.5, essential: true },
      { name: 'Comfort item / small activity for stress and boredom', qty: (h) => `${h.children}`, cost: (h) => h.children * 5, essential: false }
    ]
  },
  {
    id: 'elderly',
    title: 'For elderly / additional medical needs',
    note: null,
    showIf: (h) => h.elderly > 0,
    items: [
      { name: 'Spare mobility/medical aid batteries (hearing aids, etc.)', qty: () => 'check specific devices', cost: () => 5, essential: true, climateSensitive: true },
      { name: 'Extra blanket/warmth layer', qty: (h) => `${h.elderly}`, cost: (h) => h.elderly * 8, essential: false }
    ]
  },
  {
    id: 'wellbeing',
    title: 'Comfort & wellbeing',
    note: 'Swedish and French civil preparedness guidance both flag this: stress and boredom are real during a multi-day disruption, especially with kids at home and no power/internet.',
    items: [
      { name: 'Playing cards, a board game, or books for the whole household', qty: () => '1-2 items', cost: () => 10, essential: false }
    ]
  },
  {
    id: 'pets',
    title: 'For pets',
    note: null,
    showIf: (h) => h.pets > 0,
    items: [
      { name: 'Pet food', qty: (h) => `${h.pets * h.duration} portions (covers ${h.duration} day${h.duration === 1 ? '' : 's'})`, cost: (h) => h.pets * h.duration * 1.5, essential: true },
      { name: 'Water bowl + extra water allowance', qty: (h) => `+${h.pets * h.duration * 1} litres`, cost: () => 5, essential: true }
    ]
  }
];

const DIET_NOTES = {
  halal: 'Check tinned meat/meals are halal-certified; tinned fish, beans, vegetables are usually fine.',
  vegetarian: 'Swap meat-based ration packs/tins for vegetarian versions (beans, lentils, vegetable options).',
  vegan: 'Check tins and ration packs for dairy/egg; choose plant-based UHT milk alternative.',
  'gluten-free': 'Check ration packs and snacks are labelled gluten-free.',
  'nut-allergy': 'Avoid nut-based snacks/bars; check ration pack ingredient labels carefully.',
  'infant-formula': 'Stock enough formula/baby food for the full duration — do not rely on being able to buy more.'
};
