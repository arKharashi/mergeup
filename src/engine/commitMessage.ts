/** Messages the team treats as meaningless, in English and Arabic. */
const MEANINGLESS = /^(fix|fixes|fixed|fix stuff|update|updates|updated|wip|asd|asdf|test|testing|change|changes|edit|edits|stuff|done|minor|misc|commit|تعديل|تعديلات|اصلاح|إصلاح|تحديث|تغيير|شغل)$/i;

/**
 * A commit message is weak when its first line has fewer than 3 words
 * or is one of the classic meaningless messages.
 * This rule is the team's convention (see docs/design.md).
 */
export function isWeakMessage(message: string): boolean {
  const first = (message.split('\n')[0] ?? '').trim();
  const words = first.split(/\s+/).filter(Boolean);
  return words.length < 3 || MEANINGLESS.test(first);
}
