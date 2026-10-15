import type { Bilingual, Person } from '../engine';

export type NpcId = 'abufahd' | 'khalid' | 'sara' | 'noura' | 'rayan' | 'salman';

export interface Npc extends Person {
  id: NpcId;
  /** `name` is how the chat shows them in Arabic, and their git identity. This is the English one. */
  en: string;
  /** One letter for the chat avatar. */
  mark: Bilingual;
  role: string;
  /** How they write and act. Keep their lines consistent with this. */
  personality: string;
  /** The level where they first appear (docs/design.md). */
  firstLevel: number;
}

export const TEAM: Readonly<Record<NpcId, Npc>> = {
  abufahd: {
    id: 'abufahd',
    name: 'أبو فهد',
    email: 'abufahd@bun.team',
    en: 'Abu Fahd',
    mark: { ar: 'ف', en: 'F' },
    role: 'قائد الفريق (Team Lead)',
    personality: 'هادي ومحترم، يشرح ليش قبل كيف، لكن يغيّر الأولويات فجأة ويقاطعك بمهام عاجلة.',
    firstLevel: 1,
  },
  khalid: {
    id: 'khalid',
    name: 'خالد',
    email: 'khalid@bun.team',
    en: 'Khalid',
    mark: { ar: 'خ', en: 'K' },
    role: 'مطور أول ومراجع الكود',
    personality: 'صارم ودقيق ومختصر. يطلب تعديلات حسب قواعد واضحة، وما يجامل.',
    firstLevel: 5,
  },
  sara: {
    id: 'sara',
    name: 'سارة',
    email: 'sara@bun.team',
    en: 'Sara',
    mark: { ar: 'س', en: 'S' },
    role: 'مطورة Backend',
    personality: 'سريعة ومتحمسة، تدمج على main بدون ما تسأل، فتسبب لك conflicts.',
    firstLevel: 6,
  },
  noura: {
    id: 'noura',
    name: 'نورة',
    email: 'noura@bun.team',
    en: 'Noura',
    mark: { ar: 'ن', en: 'N' },
    role: 'مطورة Frontend',
    personality: 'متعاونة ولطيفة. تنضم لفريقك لما تصير مدير، وأول وحدة تراجع شغلها.',
    firstLevel: 12,
  },
  rayan: {
    id: 'rayan',
    name: 'ريان',
    email: 'rayan@bun.team',
    en: 'Rayan',
    mark: { ar: 'ر', en: 'R' },
    role: 'متدرب جديد',
    personality: 'متحمس ويغلط: يدمج كود خربان، ويرفع ملفات أسرار بالغلط، ويسوي push --force.',
    firstLevel: 8,
  },
  salman: {
    id: 'salman',
    name: 'سلمان',
    email: 'salman@bun.team',
    en: 'Salman',
    mark: { ar: 'ل', en: 'L' },
    role: 'متدرب في فريقك',
    personality: 'جديد ومتردد، يفتح PRs كبيرة وفوضوية ويحتاج توجيه بأسلوب ما يحبطه.',
    firstLevel: 13,
  },
};

export const person = (id: NpcId): Person => ({ name: TEAM[id].name, email: TEAM[id].email });

/** The name the chat shows, in both languages. */
export const npcName = (id: NpcId): Bilingual => ({ ar: TEAM[id].name, en: TEAM[id].en });
