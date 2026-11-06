/** Joins class names, skipping empty ones: cx('btn', isActive && 'btn--active'). */
export function cx(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(' ')
}
