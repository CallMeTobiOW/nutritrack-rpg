import { describe, expect, it } from 'vitest';
import { GENERIC_FOODS } from '../../data/genericFoods';
import { correctQuery, editDistance, normalise, rankFoods, scoreFood, singular, tokenise, vocabularyOf, type Searchable } from '../foodSearch';

const off = (name: string, brand?: string, barcode?: string): Searchable => ({ name, brand, barcode, source: 'off' });
const names = (xs: Searchable[]) => xs.map((x) => x.name);

describe('text helpers', () => {
  it('normalises case, accents and punctuation', () => {
    expect(normalise("  Sainsbury's  Café-Latte! ")).toBe('sainsbury s cafe latte');
    expect(normalise('Mac & Cheese')).toBe('mac and cheese');
  });
  it('turns simple plurals into singulars', () => {
    expect(singular('oranges')).toBe('orange');
    expect(singular('berries')).toBe('berry');
    expect(singular('tomatoes')).toBe('tomato');
    expect(singular('peaches')).toBe('peach');
    expect(singular('cheeses')).toBe('cheese');
    expect(singular('hummus')).toBe('hummus');
    expect(singular('glass')).toBe('glass');
    expect(singular('egg')).toBe('egg');
    expect(tokenise('Chicken Breasts')).toEqual(['chicken', 'breast']);
  });
  it('counts a swapped pair of letters as one slip', () => {
    expect(editDistance('oragne', 'orange')).toBe(1);
    expect(editDistance('banan', 'banana')).toBe(1);
    expect(editDistance('apple', 'apple')).toBe(0);
    expect(editDistance('apple', 'zebra', 2)).toBeGreaterThan(2);
  });
});

describe('ranking: the "orange" problem', () => {
  const results: Searchable[] = [
    off('Orange Juice', 'Tropicana'),
    off('Orange Squash No Added Sugar', 'Robinsons'),
    off('Fanta Orange', 'Fanta'),
    off("Terry's Chocolate Orange", "Terry's"),
    off('Oranges', 'Tesco'),
    off('Orange Flavoured Jelly', 'Hartley'),
  ];
  const all = [...results, ...GENERIC_FOODS];

  it('puts the plain orange first, whatever order the products arrive in', () => {
    expect(rankFoods('orange', all)[0].name).toBe('Orange');
    expect(rankFoods('orange', [...results].reverse())[0].name).toBe('Oranges');
  });
  it('keeps juice and chocolate below the plain fruit', () => {
    const r = names(rankFoods('orange', all));
    expect(r.indexOf('Orange')).toBeLessThan(r.indexOf('Orange Juice'));
    expect(r.indexOf('Oranges')).toBeLessThan(r.indexOf("Terry's Chocolate Orange"));
    expect(r.indexOf('Oranges')).toBeLessThan(r.indexOf('Orange Squash No Added Sugar'));
  });
  it('still finds juice when asked for it', () => {
    expect(rankFoods('orange juice', all)[0].name).toBe('Orange juice');
    expect(rankFoods('juice orange', all)[0].name).toMatch(/juice/i);
  });
  it('matches plurals and typos', () => {
    expect(rankFoods('oranges', all)[0].name).toBe('Orange');
    expect(rankFoods('oragne', all)[0].name).toBe('Orange');
    expect(rankFoods('banannas', all)[0].name).toBe('Banana');
  });
  it('finds a food while it is still being typed', () => {
    expect(rankFoods('chicke', all)[0].name).toMatch(/^Chicken/);
    expect(rankFoods('straw', all)[0].name).toBe('Strawberries');
  });
});

describe('ranking: everyday foods', () => {
  it.each([
    ['apple', /^Apple$/],
    ['chicken breast', /^Chicken breast/],
    ['egg', /^Egg$/],
    ['eggs', /^Egg$/],
    ['milk', /milk$/],
    ['jacket potato', /^Potato \(baked/],
    ['houmous', /^Hummus$/],
    ['yogurt', /yoghurt/],
    ['mozarella', /^Mozzarella$/],
    ['easy peeler', /^Satsuma$/],
  ])('"%s" finds the right food first', (q, expected) => {
    expect(rankFoods(q, GENERIC_FOODS)[0].name).toMatch(expected);
  });
  it('returns nothing for gibberish', () => {
    expect(rankFoods('qzxwv', GENERIC_FOODS)).toEqual([]);
  });
  it('needs every search word to be found', () => {
    expect(rankFoods('orange kryptonite', GENERIC_FOODS)).toEqual([]);
  });
});

describe('ranking: brands, saved foods and barcodes', () => {
  it('finds a brand', () => {
    const r = rankFoods('tesco', [off('Fusilli', 'Tesco'), off('Fusilli', 'Barilla')]);
    expect(r.map((x) => x.brand)).toEqual(['Tesco']);
  });
  it('lets a food you use a lot beat an equal stranger', () => {
    const mine: Searchable = { name: 'Oat bar', source: 'off', useCount: 6 };
    expect(rankFoods('oat bar', [off('Oat bar'), mine])[0]).toBe(mine);
  });
  it("puts the player's own exact food above a product", () => {
    const mine: Searchable = { name: 'Orange', source: 'custom' };
    expect(rankFoods('orange', [off('Orange Juice'), mine])[0]).toBe(mine);
  });
  it('matches a typed barcode exactly or partly', () => {
    const a = off('Beans', 'Heinz', '5000157024671');
    expect(scoreFood('5000157024671', a)).toBeGreaterThan(scoreFood('500015', a));
    expect(scoreFood('500015', a)).toBeGreaterThan(0);
    expect(scoreFood('9999999', a)).toBe(0);
  });
  it('keeps the original order when scores tie', () => {
    const r = rankFoods('cola', [off('Cola A'), off('Cola B'), off('Cola C')]);
    expect(names(r)).toEqual(['Cola A', 'Cola B', 'Cola C']);
  });
  it('shows everything for an empty search', () => {
    expect(rankFoods('', [off('A'), off('B')])).toHaveLength(2);
  });
});

describe('correctQuery', () => {
  const vocab = vocabularyOf(GENERIC_FOODS);
  it('fixes typos using known words', () => {
    expect(correctQuery('oragne', vocab)).toBe('orange');
    expect(correctQuery('chiken breast', vocab)).toBe('chicken breast');
  });
  it('leaves correct, short and unknown words alone', () => {
    expect(correctQuery('orange', vocab)).toBeNull();
    expect(correctQuery('oranges', vocab)).toBeNull();
    expect(correctQuery('xyz', vocab)).toBeNull();
    expect(correctQuery('quavers', vocab)).toBeNull();
  });
});
