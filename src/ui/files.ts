import type { Game } from '../game/game';
import { $, esc } from './dom';

const LEGEND =
  '<div class="legend">' +
  '<span><span class="badge modified">M</span> عدّلته وما جهّزته</span>' +
  '<span><span class="badge staged">M</span> جاهز للـ commit</span>' +
  '<span><span class="badge untracked">U</span> جديد</span>' +
  '<span><span class="badge ignored">!</span> متجاهَل</span>' +
  '</div>';

/** File list with git badges, and a plain editor. Saving writes to the working tree. */
export class FilesView {
  private readonly list = $<HTMLUListElement>('#files');
  private readonly editor = $('#editor');
  private readonly repoName = $('#repoName');
  private open: string | null = null;
  /** The file content when the editor loaded it, to notice changes made by commands. */
  private base = '';
  private dirty = false;
  private creating = false;

  constructor(private readonly game: Game) {
    this.list.addEventListener('click', (e) => {
      const b = (e.target as HTMLElement).closest<HTMLButtonElement>('button[data-file]');
      if (!b) return;
      if (this.dirty) this.save();
      this.openFile(b.dataset.file!);
    });
    this.editor.addEventListener('input', (e) => {
      if ((e.target as HTMLElement).id !== 'edText') return;
      this.dirty = true;
      $('#edDirty').hidden = false;
    });
    this.editor.addEventListener('keydown', (e) => {
      if ((e.target as HTMLElement).id === 'edText' && (e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        this.save();
      }
    });
    this.editor.addEventListener('click', (e) => {
      const id = (e.target as HTMLElement).id;
      if (id === 'edSave') this.save();
      else if (id === 'edClose') {
        if (this.dirty) this.save();
        this.open = null;
        this.renderEditor();
      } else if (id === 'newBtn') {
        this.creating = true;
        this.renderEditor();
        $<HTMLInputElement>('#newName').focus();
      } else if (id === 'newCancel') {
        this.creating = false;
        this.renderEditor();
      }
    });
    this.editor.addEventListener('submit', (e) => {
      if ((e.target as HTMLElement).id !== 'newForm') return;
      e.preventDefault();
      const name = $<HTMLInputElement>('#newName').value.trim();
      if (!this.game.createFile(name)) {
        $('#newError').hidden = false;
        return;
      }
      this.creating = false;
      this.openFile(name);
      $<HTMLTextAreaElement>('#edText').focus();
    });
  }

  /** Called on level load. */
  reset(): void {
    this.open = null;
    this.dirty = false;
    this.creating = false;
    this.render();
  }

  render(): void {
    const files = this.game.files();
    const hasRepo = !!this.game.session?.world.local;
    this.repoName.textContent = hasRepo ? this.game.session!.world.local!.dir : '';
    if (!hasRepo) {
      this.list.hidden = true;
      this.list.innerHTML = '';
      this.editor.innerHTML =
        '<div class="empty"><strong>ما فيه ملفات للحين.</strong>' +
        '<span>المشروع عند الفريق، وأنت تحتاج نسخة منه. استخدم <code>git clone</code> في الطرفية.</span></div>';
      return;
    }
    this.list.hidden = false;
    if (this.open && !files.some((f) => f.path === this.open)) {
      this.open = null;
      this.dirty = false;
    }
    this.list.innerHTML = files
      .map(
        (f) =>
          '<li><button type="button" data-file="' + esc(f.path) + '"' + (this.open === f.path ? ' aria-current="true"' : '') + '>' +
          '<span>' + esc(f.path) + '</span>' +
          (f.badge ? '<span class="badge ' + f.badge.kind + '" title="' + esc(f.badge.title) + '">' + f.badge.code + '</span>' : '') +
          '</button></li>',
      )
      .join('');
    this.syncEditor();
  }

  private openFile(path: string): void {
    this.open = path;
    this.dirty = false;
    this.renderEditor();
    this.render();
  }

  /** Reloads the open file if a command changed it and the player has no unsaved edits. */
  private syncEditor(): void {
    const ta = document.querySelector<HTMLTextAreaElement>('#edText');
    if (!this.open || !ta || ta.dataset.file !== this.open) {
      this.renderEditor();
      return;
    }
    const current = this.game.readFile(this.open) ?? '';
    if (!this.dirty && current !== this.base) {
      ta.value = current;
      this.base = current;
    }
  }

  private renderEditor(): void {
    if (!this.game.session?.world.local) return;
    if (!this.open) {
      this.editor.innerHTML =
        '<div class="empty"><span>اختر ملف من القائمة تعدّله، أو أنشئ ملف جديد.</span></div>' +
        (this.creating
          ? '<form class="edfoot" id="newForm"><input id="newName" placeholder="مثل: .gitignore" aria-label="اسم الملف الجديد" dir="ltr">' +
            '<button type="submit" class="btn primary">إنشاء</button><button type="button" class="btn ghost" id="newCancel">إلغاء</button>' +
            '<span class="ederr" id="newError" hidden>اسم غير صالح: بدون مسافات أو مجلدات.</span></form>'
          : '<div class="edfoot"><button type="button" class="btn" id="newBtn">ملف جديد</button></div>') +
        LEGEND;
      return;
    }
    const content = this.game.readFile(this.open) ?? '';
    this.base = content;
    this.editor.innerHTML =
      '<div class="edhead"><span class="fname">' + esc(this.open) + '</span>' +
      '<span class="dirty" id="edDirty"' + (this.dirty ? '' : ' hidden') + '>تعديلات ما انحفظت</span></div>' +
      '<textarea id="edText" dir="auto" spellcheck="false" aria-label="محتوى الملف"></textarea>' +
      '<div class="edfoot"><button type="button" class="btn primary" id="edSave">حفظ</button>' +
      '<button type="button" class="btn ghost" id="edClose">إغلاق</button>' +
      '<span class="edkey">Ctrl/⌘ + S</span></div>';
    const ta = $<HTMLTextAreaElement>('#edText');
    ta.value = content;
    ta.dataset.file = this.open;
  }

  private save(): void {
    const ta = document.querySelector<HTMLTextAreaElement>('#edText');
    if (!ta || !this.open) return;
    this.dirty = false;
    this.game.writeFile(this.open, ta.value);
    this.base = this.game.readFile(this.open) ?? '';
    ta.value = this.base;
    const flag = document.querySelector<HTMLElement>('#edDirty');
    if (flag) flag.hidden = true;
  }
}
