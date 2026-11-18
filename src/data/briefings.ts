/**
 * Daily briefings — 120 original motivational speeches written for
 * NutriTrack RPG. The speakers are original characters invented for this app.
 *
 * Categories:
 *   fantasy   — lore keepers and old magic          (Elder Thessa, The Archivist)
 *   commander — futuristic, tactical, mission-ready  (Commander Ryn Vale)
 *   warrior   — discipline, steel and endurance      (Kael Ironvow)
 *   mentor    — warm, encouraging, human             (Mentor Ash)
 */

export type BriefingCategory = 'fantasy' | 'commander' | 'warrior' | 'mentor';

export interface Briefing {
  id: string;
  category: BriefingCategory;
  text: string;
}

export const SPEAKERS: Record<BriefingCategory, { name: string; title: string; accent: string }> = {
  fantasy: { name: 'Elder Thessa', title: 'Keeper of the Ember Grove', accent: '#f5a524' },
  commander: { name: 'Commander Ryn Vale', title: 'Orbital Vanguard, Strike Group Aurora', accent: '#38bdf8' },
  warrior: { name: 'Kael Ironvow', title: 'First Blade of the Ashen Wall', accent: '#f97316' },
  mentor: { name: 'Mentor Ash', title: 'Trainer of the Lantern Hall', accent: '#a78bfa' },
};

const fantasy: string[] = [
  'The old songs never open on a feast or a coronation. They open on a grey dawn and a traveller lacing their boots. Lace yours.',
  'The great oaks of the Ember Grove did not grow in a season. They grew one quiet ring at a time. Add your ring today.',
  'There is an old rune carved above the gate: "Strength is gathered, never found." Go and gather a little of it.',
  'The river does not argue with the stone. It simply returns, again and again, until the stone gives way. Be the river today.',
  'Long ago, the first wardens trained by lantern light, when no one was watching. Their names are still spoken. Yours will be too.',
  'Magic is only discipline that has been practised long enough to look effortless. Practise yours today.',
  'The map ahead is unwritten, traveller. Each meal logged, each cup of water, each step taken inks another line of it.',
  'Dragons were never slain by those who waited for the perfect sword. They were slain by those who walked into the cave anyway.',
  'Your body is the oldest companion you will ever have. Today, treat it like an ally you intend to keep for the whole journey.',
  'The stars you see tonight left their light long ago, and still they arrive. Your effort works the same way. Shine anyway.',
  'In the archives there is a book with no ending. Its last page says only: "And then they tried again." Write the next line.',
  'Fire needs fuel, air and patience. So do you. Feed the flame well and do not rush the burn.',
  'A seed in winter looks like nothing at all. Do not judge your progress by the season you are in.',
  'The bards will not sing of the day you were perfect. They will sing of the day you kept going when it was hard.',
  'Every hero carries a pack. Today, fill yours with water, good food and one promise you will keep.',
  'The ancient forge only burns hot for those who keep feeding it. Tend your forge today, smith.',
  'Mountains are climbed by those who look at the next foothold, not the summit. Find your next foothold.',
  'There is a quiet power in an unbroken chain of small days. Add a link, and the chain grows stronger than steel.',
  'The old masters said the hardest spell is the one cast every single day. You already know its words: show up.',
  'Even the moon waxes slowly. Fullness is a journey of small, patient nights. Be patient with yours.',
  'You are not behind. You are exactly at the chapter where the hero decides who they will become.',
  'The wolves of doubt howl loudest at the edge of the forest. Walk past them. They have never once caught a traveller who kept moving.',
  'Your quest log is not a list of chores. It is a record of promises made to the person you are becoming.',
  'The Archivist keeps every victory, no matter how small. Today they have a fresh page waiting with your name on it.',
  'Somewhere down the road, a stronger version of you is already waiting at camp. Every good choice today shortens the walk.',
  'Rest is not retreat. Even the mightiest guardian sleeps, eats and drinks before the next watch.',
  'Old roots run deep because they drank steadily, season after season. Drink deeply today.',
  'The path of a thousand leagues forgives a slow step. It never forgives standing still forever.',
  'A crown is only metal. What makes a ruler is a thousand daily decisions. Rule your day well.',
  'Light a single torch, and the dark hall is no longer dark. One good choice is enough to begin.',
];

const commander: string[] = [
  'Morning, operative. Mission parameters are simple: fuel properly, hydrate, complete objectives. The rest is execution.',
  'This is Vale on comms. Every decision between now and nightfall is a waypoint. Hit enough waypoints and the route takes care of itself.',
  'Status report: systems nominal, potential unlimited. All that is missing is your first action. Deploy.',
  'Strike Group Aurora does not wait for perfect conditions. We adapt, we advance, we complete the mission. So do you.',
  'Your body is the most advanced piece of equipment you will ever be issued. Maintain it like the mission depends on it, because it does.',
  'Intel suggests today will contain obstacles. Good. Obstacles are just objectives that have not been completed yet.',
  'Operative, I do not need you to be flawless. I need you to be consistent. Consistency wins campaigns.',
  'Check your loadout: water, protein, a plan. You are cleared for launch.',
  'Every great operation is a chain of small, correct moves. Make the next correct move. Then the next.',
  'Hydration levels are a tactical advantage. A soldier running dry makes mistakes. Top up and stay sharp.',
  'I have seen elite units fall apart because they skipped the basics. Today, we honour the basics.',
  'The enemy is not hunger, or fatigue, or a bad day. The enemy is the voice that says tomorrow. Today, we overrule it.',
  'Mission clock is running. You do not need to win the whole war today. Just take this sector.',
  'Telemetry shows you have survived every hard day so far. One hundred percent success rate. Let us keep that record.',
  'Momentum is a resource. Generate some early and spend it wisely across the day.',
  'Command does not award medals for intensity. We award them for showing up, shift after shift. Report for duty.',
  'Your objectives are loaded on the board. Clear them in any order. Just clear them.',
  'Even the fastest ship needs refuelling. Do not run your reactor on empty. Eat like a professional.',
  'Recalibrating is not failing. If yesterday went sideways, adjust course and re-engage.',
  'The squad is counting on you, and the squad is you, six months from now. Do not let them down.',
  'Precision beats panic. Log the meal, drink the water, take the walk. Precise, repeatable, effective.',
  'Shields up, operative. Distractions inbound. Hold your formation and stay on mission.',
  'You were not recruited for a single heroic day. You were recruited for the long campaign. Pace yourself and endure.',
  'Data does not lie, and neither does effort. Track honestly, and the numbers will show you the way forward.',
  'Command confirms: rest days are part of the operation. Recovery is how strong units stay strong.',
  'No transmission from the future has ever regretted a glass of water or a good night’s sleep. Act accordingly.',
  'Today is a training simulation for the person you are becoming. Run it with full effort.',
  'Target acquired: a better version of you. Range: one day closer than yesterday. Engage.',
  'Vale out. You have your orders, your fuel and your objectives. Go and do the work.',
  'Systems check complete. Morale: rising. Mission: yours. Make it count.',
];

const warrior: string[] = [
  'Steel is not born sharp. It is struck, again and again, until it holds an edge. Today, you are the steel.',
  'No crowd gathers to watch a soldier eat a proper breakfast or drink their water. Do it anyway. The crowd only arrives at the end.',
  'The wall does not fall because the enemy is strong. It falls because the guard stopped standing watch. Stand your watch.',
  'Pain from discipline weighs ounces. Regret weighs tons. Carry the lighter load.',
  'A blade left in its sheath grows dull. A body left idle does the same. Draw your sword today, even for a moment.',
  'There is no shortcut to the top of the Ashen Wall. There are only steps. Climb.',
  'I do not train because I am strong. I am strong because I train. Begin, and strength follows.',
  'Your excuses have fought you for years. Today, you fight back.',
  'A warrior eats to fight, not to forget. Fuel yourself with purpose.',
  'Discipline is choosing between what you want now and what you want most. Choose what you want most.',
  'Every rep, every glass of water, every honest meal logged is another strike against the person you used to be.',
  'The first blow is the hardest. After that, the body remembers it was built for this.',
  'I have seen giants fall and small soldiers rise. The difference was never size. It was persistence.',
  'Do not ask for an easier battle. Ask to become a stronger warrior.',
  'The forge is hot and the hammer is heavy. Good. That is how armour is made.',
  'Stand tall. Breathe deep. Your ancestors survived far harder days than this so that you could have this one.',
  'You will not always feel motivated. Warriors do not wait for feelings. They wait for nothing.',
  'Victory belongs to the one who refuses to stay down. If yesterday knocked you over, rise.',
  'Sharpen your blade with sleep, temper it with good food, polish it with water. Then go to war.',
  'The battle you avoid today becomes the war you face tomorrow. Meet it now, while it is small.',
  'Your oath is simple: fuel, move, rest, repeat. Keep your oath.',
  'A shield is only as strong as the arm that holds it. Strengthen the arm.',
  'There is honour in the unseen work. The meal prepared, the stretch completed, the water drunk. Honour it.',
  'The ground is cold and the hill is steep. Climb it anyway. That is what we do.',
  'Hunger for progress, not for punishment. A warrior respects their body. They do not break it.',
  'Iron sharpens iron. Today, let your quests sharpen you.',
  'You are not here to be perfect. You are here to be relentless.',
  'Every morning, the war horn sounds. Most people roll over. You are not most people.',
  'Strength gained slowly is strength that stays. Build it brick by brick.',
  'Lift your chin. Grip your blade. The day is yours to take.',
];

const mentor: string[] = [
  'Nobody is grading today out of ten. Do a handful of good things for your body and call that a win, because it is one.',
  'Hey. Whatever happened yesterday, today is a fresh save file. Let us make some good choices together.',
  'You do not have to do everything today. Pick one quest and finish it. Then see how you feel.',
  'Be kind to yourself this morning. Progress grows best in friendly soil.',
  'Small wins still count. In fact, small wins are how every big win is built.',
  'If today feels heavy, shrink the goal, not the effort. A short walk is still a walk.',
  'Remember why you started. Write it on the inside of your mind and read it when things get hard.',
  'You are allowed to rest. You are allowed to eat well. You are allowed to be proud of yourself.',
  'Consistency over intensity. A steady flame warms a house; a bonfire burns out by midnight.',
  'There are no failed days, only days with lessons in them. What will today teach you?',
  'Drink some water before you do anything else. Future-you says thanks already.',
  'Every expert was once a beginner who did not quit. Keep going.',
  'Your worth is not measured by a number on a scale. The scale measures gravity. You measure growth.',
  'Missed a day? That is fine. The streak is a tool, not a judge. Start the next one now.',
  'Fuel your body like someone you love depends on it, because someone does: you.',
  'Celebrate the quiet victories: the extra glass of water, the vegetables at lunch, the early night.',
  'You are building a life, not cramming for a test. Take it one day at a time.',
  'Some days you will level up. Some days you will just hold the line. Both are victories.',
  'Your future self is cheering for you right now. Can you hear them?',
  'It is okay to start small. Mighty rivers begin as tiny streams in the mountains.',
  'Progress, not perfection. Say it once more for good measure: progress, not perfection.',
  'Feeling unmotivated is normal. Action creates motivation, not the other way around. Take one tiny step.',
  'Eat enough. Rest enough. Move enough. Enough is a powerful word.',
  'You have already done something brave today: you opened the app and chose to try. That counts.',
  'You do not need a perfect plan. You need a good-enough plan and the courage to begin.',
  'Look how far you have come since your first day here. Now imagine where a few more weeks will take you.',
  'Being gentle with yourself is not weakness. It is the kind of strength that lasts.',
  'The goal is not to be better than anyone else. The goal is to be better than the you of last month.',
  'Today, choose one thing that makes your body feel good. Then do it again tomorrow.',
  'I believe in you. Now let us go prove me right.',
];

const build = (category: BriefingCategory, list: string[]): Briefing[] =>
  list.map((text, i) => ({ id: `${category}-${String(i + 1).padStart(2, '0')}`, category, text }));

export const BRIEFINGS: Briefing[] = [
  ...build('fantasy', fantasy),
  ...build('commander', commander),
  ...build('warrior', warrior),
  ...build('mentor', mentor),
];

export const BRIEFING_BY_ID = new Map(BRIEFINGS.map((b) => [b.id, b]));
