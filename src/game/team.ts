import type { Person } from '../engine';

export type NpcId = 'abufahd' | 'khalid' | 'sara' | 'noura' | 'rayan' | 'salman';

export interface Npc extends Person {
  id: NpcId;
  /** One letter for the chat avatar. */
  mark: string;
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
    mark: 'ف',
    role: 'قائد الفريق (Team Lead)',
    personality: 'هادي ومحترم، يشرح ليش قبل كيف، لكن يغيّر الأولويات فجأة ويقاطعك بمهام عاجلة.',
    firstLevel: 1,
  },
  khalid: {
    id: 'khalid',
    name: 'خالد',
    email: 'khalid@bun.team',
    mark: 'خ',
    role: 'مطور أول ومراجع الكود',
    personality: 'صارم ودقيق ومختصر. يطلب تعديلات حسب قواعد واضحة، وما يجامل.',
    firstLevel: 5,
  },
  sara: {
    id: 'sara',
    name: 'سارة',
    email: 'sara@bun.team',
    mark: 'س',
    role: 'مطورة Backend',
    personality: 'سريعة ومتحمسة، تدمج على main بدون ما تسأل، فتسبب لك conflicts.',
    firstLevel: 6,
  },
  noura: {
    id: 'noura',
    name: 'نورة',
    email: 'noura@bun.team',
    mark: 'ن',
    role: 'مطورة Frontend',
    personality: 'متعاونة ولطيفة. تنضم لفريقك لما تصير مدير، وأول وحدة تراجع شغلها.',
    firstLevel: 12,
  },
  rayan: {
    id: 'rayan',
    name: 'ريان',
    email: 'rayan@bun.team',
    mark: 'ر',
    role: 'متدرب جديد',
    personality: 'متحمس ويغلط: يدمج كود خربان، ويرفع ملفات أسرار بالغلط، ويسوي push --force.',
    firstLevel: 8,
  },
  salman: {
    id: 'salman',
    name: 'سلمان',
    email: 'salman@bun.team',
    mark: 'ل',
    role: 'متدرب في فريقك',
    personality: 'جديد ومتردد، يفتح PRs كبيرة وفوضوية ويحتاج توجيه بأسلوب ما يحبطه.',
    firstLevel: 13,
  },
};

export const person = (id: NpcId): Person => ({ name: TEAM[id].name, email: TEAM[id].email });
