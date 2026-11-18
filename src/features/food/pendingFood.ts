/**
 * Hand-off between the custom-food form and the add-food screen: after a new
 * food is created we go back one step in history and the add screen opens
 * the portion picker for it. Keeps the back stack clean.
 */
let pending: string | null = null;

export function setPendingFood(id: string) {
  pending = id;
}

export function takePendingFood(): string | null {
  const id = pending;
  pending = null;
  return id;
}
