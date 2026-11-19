/**
 * Everyday foods that have no barcode: fruit, veg, meat, eggs, dairy, bread,
 * rice and so on. They ship inside the app, so "orange" finds an orange (not
 * only orange juice) even offline.
 *
 * Values are typical figures per 100 g (or 100 ml) for the plain food as
 * eaten in the UK, in line with the UK government's food composition tables
 * (CoFID, Open Government Licence). They are rounded typical values, not lab
 * results for one product; the portion sheet lets the player correct them.
 * `genericFoods.test.ts` checks that every row is internally consistent.
 */
import type { Food } from '../lib/models';
import type { MeasureUnit } from '../lib/nutrition';

/** [name, extra search words, kcal, protein, carbs, sugars, fat, saturates, fibre, sodium mg, unit, serving label, serving amount] */
type Row = readonly [string, string, number, number, number, number, number, number, number, number, MeasureUnit, string, number];

const ROWS: readonly Row[] = [
  // Fruit
  ['Orange', 'oranges citrus fruit', 37, 0.9, 8.5, 8.5, 0.1, 0, 1.7, 5, 'g', '1 medium orange (peeled, 130 g)', 130],
  ['Satsuma', 'easy peeler clementine mandarin tangerine', 36, 0.8, 8.5, 8.3, 0.1, 0, 1.3, 4, 'g', '1 satsuma (peeled, 70 g)', 70],
  ['Apple', 'apples eating apple gala braeburn', 48, 0.4, 11.8, 11.8, 0.1, 0, 1.8, 3, 'g', '1 medium apple (150 g)', 150],
  ['Pear', 'pears conference', 40, 0.3, 10, 10, 0.1, 0, 2.2, 3, 'g', '1 medium pear (160 g)', 160],
  ['Banana', 'bananas', 95, 1.2, 23.2, 20.9, 0.3, 0.1, 1.1, 1, 'g', '1 medium banana (peeled, 120 g)', 120],
  ['Grapes', 'grape red green seedless', 60, 0.4, 15.4, 15.4, 0.1, 0, 0.7, 2, 'g', '1 small bunch (80 g)', 80],
  ['Strawberries', 'strawberry', 27, 0.8, 6, 6, 0.1, 0, 1.1, 6, 'g', '1 handful (80 g)', 80],
  ['Blueberries', 'blueberry', 45, 0.7, 10, 10, 0.2, 0, 1.5, 3, 'g', '1 handful (80 g)', 80],
  ['Raspberries', 'raspberry', 25, 0.9, 4.6, 4.4, 0.3, 0, 2.5, 3, 'g', '1 handful (80 g)', 80],
  ['Kiwi fruit', 'kiwi kiwifruit', 49, 1.1, 10.6, 10.3, 0.5, 0, 1.9, 4, 'g', '1 kiwi (peeled, 70 g)', 70],
  ['Pineapple', 'pineapples fresh', 47, 0.5, 11, 9.9, 0.1, 0, 1, 2, 'g', '1 slice (80 g)', 80],
  ['Mango', 'mangoes mangos', 62, 0.8, 13.5, 13.4, 0.4, 0.1, 1.6, 2, 'g', '½ mango (peeled, 100 g)', 100],
  ['Watermelon', 'melon', 30, 0.6, 7.6, 6.2, 0.2, 0, 0.4, 1, 'g', '1 slice (150 g)', 150],
  ['Avocado', 'avocados', 190, 1.9, 1.9, 0.5, 19.5, 4.1, 3.4, 6, 'g', '½ avocado (70 g)', 70],
  ['Tomato', 'tomatoes fresh', 17, 0.7, 3.1, 3.1, 0.3, 0.1, 1, 9, 'g', '1 medium tomato (85 g)', 85],
  // Vegetables and pulses
  ['Carrot', 'carrots raw', 35, 0.6, 7.9, 7.4, 0.3, 0.1, 2.4, 25, 'g', '1 medium carrot (80 g)', 80],
  ['Broccoli', 'broccoli raw', 33, 4.4, 1.8, 1.5, 0.9, 0.2, 2.6, 8, 'g', '1 portion (80 g)', 80],
  ['Cucumber', 'cucumbers', 10, 0.7, 1.5, 1.5, 0.1, 0, 0.6, 3, 'g', '¼ cucumber (80 g)', 80],
  ['Onion', 'onions raw', 36, 1.2, 7.9, 5.2, 0.2, 0, 1.4, 3, 'g', '1 medium onion (110 g)', 110],
  ['Spinach', 'spinach raw leaves', 25, 2.8, 1.6, 1.5, 0.8, 0.1, 2.1, 79, 'g', '1 handful (30 g)', 30],
  ['Red pepper', 'peppers bell pepper capsicum', 31, 1, 6, 4.2, 0.3, 0.1, 2.1, 4, 'g', '1 pepper (160 g)', 160],
  ['Mushrooms', 'mushroom button chestnut', 13, 1.8, 0.4, 0.2, 0.5, 0.1, 1.1, 5, 'g', '1 portion (80 g)', 80],
  ['Courgette', 'courgettes zucchini', 18, 1.8, 2, 1.9, 0.4, 0.1, 1.2, 1, 'g', '½ courgette (100 g)', 100],
  ['Potato (boiled)', 'potatoes boiled new', 72, 1.8, 16.8, 0.7, 0.1, 0, 1.2, 7, 'g', '1 portion (175 g)', 175],
  ['Potato (baked, with skin)', 'jacket potato baked', 142, 3.9, 30, 1.2, 0.2, 0, 2.7, 14, 'g', '1 medium jacket potato (220 g)', 220],
  ['Sweet potato (boiled)', 'sweet potatoes', 84, 1.1, 20, 6, 0.1, 0, 3, 40, 'g', '1 portion (150 g)', 150],
  ['Baked beans in tomato sauce', 'beans haricot', 78, 4.8, 13.6, 4.8, 0.2, 0, 3.7, 240, 'g', '½ tin (200 g)', 200],
  ['Lentils (boiled)', 'lentil red green brown', 105, 8.8, 16, 0.9, 0.4, 0.1, 3.8, 2, 'g', '1 portion (120 g)', 120],
  ['Chickpeas (tinned)', 'chickpea garbanzo canned', 120, 7, 16, 0.4, 2.9, 0.3, 5, 260, 'g', '½ tin (120 g drained)', 120],
  ['Hummus', 'houmous humous dip', 235, 7.5, 11, 0.5, 17, 2.5, 5.5, 400, 'g', '2 tbsp (50 g)', 50],
  // Meat, fish and eggs
  ['Chicken breast (raw)', 'chicken skinless uncooked', 106, 23, 0, 0, 1.5, 0.4, 0, 70, 'g', '1 breast fillet (150 g)', 150],
  ['Chicken breast (cooked)', 'chicken grilled roast roasted skinless', 153, 32, 0, 0, 2.5, 0.7, 0, 75, 'g', '1 breast fillet (120 g)', 120],
  ['Chicken thigh (raw)', 'chicken skinless uncooked', 121, 20, 0, 0, 4.5, 1.2, 0, 90, 'g', '1 thigh (100 g)', 100],
  ['Turkey breast (raw)', 'turkey', 105, 24, 0, 0, 1, 0.3, 0, 60, 'g', '1 portion (120 g)', 120],
  ['Beef mince (5% fat, raw)', 'minced beef lean', 125, 21, 0, 0, 5, 2.2, 0, 70, 'g', '1 portion (125 g)', 125],
  ['Beef mince (15% fat, raw)', 'minced beef', 200, 18.5, 0, 0, 14, 6, 0, 70, 'g', '1 portion (125 g)', 125],
  ['Bacon (back, grilled)', 'rashers streaky', 211, 24.7, 0, 0, 12.5, 4.5, 0, 1400, 'g', '2 rashers (50 g)', 50],
  ['Ham (sliced)', 'wafer thin cooked ham', 105, 18, 1, 0.8, 3, 1, 0, 1060, 'g', '2 slices (30 g)', 30],
  ['Salmon fillet (raw)', 'salmon fish', 179, 20, 0, 0, 11, 2, 0, 50, 'g', '1 fillet (120 g)', 120],
  ['Cod fillet (raw)', 'cod fish white', 75, 17, 0, 0, 0.7, 0.1, 0, 60, 'g', '1 fillet (120 g)', 120],
  ['Tuna (tinned in water)', 'tuna canned fish', 105, 24, 0, 0, 0.6, 0.2, 0, 300, 'g', '1 tin (112 g drained)', 112],
  ['Egg', 'eggs boiled fried poached scrambled hens', 140, 12.5, 0, 0, 9.5, 2.5, 0, 140, 'g', '1 medium egg (50 g)', 50],
  // Dairy
  ['Whole milk', 'milk full fat', 64, 3.4, 4.6, 4.6, 3.9, 2.4, 0, 43, 'ml', '1 glass (200 ml)', 200],
  ['Semi-skimmed milk', 'milk', 47, 3.6, 4.7, 4.7, 1.7, 1.1, 0, 43, 'ml', '1 glass (200 ml)', 200],
  ['Skimmed milk', 'milk', 34, 3.5, 4.8, 4.8, 0.3, 0.2, 0, 43, 'ml', '1 glass (200 ml)', 200],
  ['Cheddar cheese', 'cheese', 416, 25.4, 0.1, 0.1, 34.9, 21.7, 0, 700, 'g', '1 matchbox (30 g)', 30],
  ['Mozzarella', 'cheese', 264, 19, 0, 0, 20.9, 14.5, 0, 400, 'g', '½ ball (62 g)', 62],
  ['Cottage cheese', 'cheese', 101, 12.6, 3.1, 3.1, 4.3, 2.7, 0, 300, 'g', '½ pot (150 g)', 150],
  ['Greek yoghurt (natural)', 'yogurt', 115, 5.7, 4.7, 4.7, 8.5, 5.5, 0, 40, 'g', '1 pot (150 g)', 150],
  ['Natural yoghurt (low fat)', 'yogurt plain', 56, 4.8, 7, 7, 0.8, 0.5, 0, 55, 'g', '1 pot (150 g)', 150],
  ['Butter', 'salted', 737, 0.5, 0.5, 0.5, 81.7, 52.1, 0, 600, 'g', '1 knob (10 g)', 10],
  // Bread, grains and cereals
  ['White bread', 'sliced loaf toast', 236, 8, 46, 3, 1.6, 0.4, 2.7, 430, 'g', '1 slice (36 g)', 36],
  ['Wholemeal bread', 'brown sliced loaf toast', 230, 9, 41, 3.5, 2.5, 0.5, 6, 430, 'g', '1 slice (36 g)', 36],
  ['White rice (boiled)', 'rice cooked', 130, 2.7, 28, 0.1, 0.3, 0.1, 0.4, 1, 'g', '1 portion (180 g)', 180],
  ['Pasta (boiled)', 'spaghetti penne fusilli cooked', 149, 5, 30, 0.6, 0.7, 0.1, 1.6, 3, 'g', '1 portion (180 g)', 180],
  ['Quinoa (cooked)', 'quinoa', 120, 4.4, 21.3, 0.9, 1.9, 0.2, 2.8, 7, 'g', '1 portion (150 g)', 150],
  ['Porridge oats (dry)', 'oats oatmeal', 372, 11, 60, 1, 8, 1.4, 9, 5, 'g', '1 bowl (40 g dry)', 40],
  ['Cornflakes', 'cereal breakfast', 375, 7, 84, 8, 0.9, 0.2, 3, 400, 'g', '1 bowl (30 g)', 30],
  ['Crisps (ready salted)', 'potato chips', 525, 6, 52, 0.5, 33, 3, 4, 500, 'g', '1 bag (25 g)', 25],
  // Fats, nuts, spreads and sweet things
  ['Olive oil', 'oil extra virgin', 899, 0, 0, 0, 99.9, 14, 0, 0, 'g', '1 tbsp (14 g)', 14],
  ['Peanut butter', 'peanut spread smooth crunchy', 620, 25, 12, 5.5, 52, 10.4, 5.5, 400, 'g', '1 tbsp (16 g)', 16],
  ['Almonds', 'nuts', 612, 21.1, 6.9, 4.2, 55.8, 4.2, 7.4, 1, 'g', '1 handful (25 g)', 25],
  ['Honey', 'runny', 305, 0.4, 76.4, 76.4, 0, 0, 0, 11, 'g', '1 tsp (7 g)', 7],
  ['Sugar (white)', 'granulated caster', 400, 0, 100, 100, 0, 0, 0, 0, 'g', '1 tsp (4 g)', 4],
  ['Dark chocolate (70%)', 'chocolate plain', 545, 7.5, 45, 24, 36, 22, 11, 20, 'g', '2 squares (20 g)', 20],
  ['Milk chocolate', 'chocolate', 532, 7.5, 57, 55, 30, 18, 2, 80, 'g', '4 squares (25 g)', 25],
  // Drinks
  ['Orange juice', 'juice drink', 38, 0.6, 8.8, 8.8, 0.1, 0, 0.2, 3, 'ml', '1 glass (200 ml)', 200],
  ['Apple juice', 'juice drink', 39, 0.1, 9.5, 9.5, 0.1, 0, 0.1, 4, 'ml', '1 glass (200 ml)', 200],
  ['Water', 'tap still sparkling', 0, 0, 0, 0, 0, 0, 0, 0, 'ml', '1 glass (250 ml)', 250],
];

export type GenericFood = Omit<Food, 'id'> & { aliases: string };

function toFood(r: Row): GenericFood {
  const [name, aliases, energy, protein, carbs, sugar, fat, satFat, fiber, sodium, unit, label, amount] = r;
  return {
    name,
    aliases,
    source: 'generic',
    unit,
    per100: { energy, protein, carbs, sugar, fat, satFat, fiber, sodium },
    servings: [{ label, amount }],
    favorite: false,
    useCount: 0,
    createdAt: 0,
    updatedAt: 0,
  };
}

export const GENERIC_FOODS: readonly GenericFood[] = ROWS.map(toFood);
