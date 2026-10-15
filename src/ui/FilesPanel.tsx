import { useState, type FormEvent, type KeyboardEvent } from 'react';
import { useGame } from './gameContext';

const LEGEND = (
  <div className="legend">
    <span>
      <span className="badge modified">M</span> عدّلته وما جهّزته
    </span>
    <span>
      <span className="badge staged">M</span> جاهز للـ commit
    </span>
    <span>
      <span className="badge untracked">U</span> جديد
    </span>
    <span>
      <span className="badge ignored">!</span> متجاهَل
    </span>
  </div>
);

/**
 * File list with git badges, and a plain editor. Saving writes to the working tree.
 * Give it key={session id} so a level load closes the editor.
 */
export function FilesPanel() {
  const game = useGame();
  const local = game.session?.world.local;
  const files = game.files();
  const [open, setOpen] = useState<string | null>(null);
  /** The player's unsaved text. While null, the editor shows the file as it is now, so commands that change it show up. */
  const [draft, setDraft] = useState<string | null>(null);
  const [focusEditor, setFocusEditor] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [newError, setNewError] = useState(false);

  // A command removed the open file.
  if (open && !files.some((f) => f.path === open)) {
    setOpen(null);
    setDraft(null);
  }

  const save = () => {
    if (!open) return;
    game.writeFile(open, draft ?? game.readFile(open) ?? '');
    setDraft(null);
  };

  const pick = (path: string) => {
    if (draft !== null) save();
    setOpen(path);
    setDraft(null);
    setFocusEditor(false);
  };

  const close = () => {
    if (draft !== null) save();
    setOpen(null);
  };

  const onEditorKey = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
      e.preventDefault();
      save();
    }
  };

  const stopCreating = () => {
    setCreating(false);
    setNewName('');
    setNewError(false);
  };

  const create = (e: FormEvent) => {
    e.preventDefault();
    const name = newName.trim();
    if (!game.createFile(name)) {
      setNewError(true);
      return;
    }
    stopCreating();
    setOpen(name);
    setDraft(null);
    setFocusEditor(true);
  };

  let editor;
  if (!local) {
    editor = (
      <div className="empty">
        <strong>ما فيه ملفات للحين.</strong>
        <span>
          المشروع عند الفريق، وأنت تحتاج نسخة منه. استخدم <code>git clone</code> في الطرفية.
        </span>
      </div>
    );
  } else if (!open) {
    editor = (
      <>
        <div className="empty">
          <span>اختر ملف من القائمة تعدّله، أو أنشئ ملف جديد.</span>
        </div>
        {creating ? (
          <form className="edfoot" id="newForm" onSubmit={create}>
            <input
              id="newName"
              placeholder="مثل: .gitignore"
              aria-label="اسم الملف الجديد"
              dir="ltr"
              autoFocus
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
            />
            <button type="submit" className="btn primary">
              إنشاء
            </button>
            <button type="button" className="btn ghost" id="newCancel" onClick={stopCreating}>
              إلغاء
            </button>
            <span className="ederr" id="newError" hidden={!newError}>
              اسم غير صالح: بدون مسافات أو مجلدات.
            </span>
          </form>
        ) : (
          <div className="edfoot">
            <button type="button" className="btn" id="newBtn" onClick={() => setCreating(true)}>
              ملف جديد
            </button>
          </div>
        )}
        {LEGEND}
      </>
    );
  } else {
    editor = (
      <>
        <div className="edhead">
          <span className="fname">{open}</span>
          <span className="dirty" id="edDirty" hidden={draft === null}>
            تعديلات ما انحفظت
          </span>
        </div>
        <textarea
          key={open}
          id="edText"
          dir="auto"
          spellCheck={false}
          aria-label="محتوى الملف"
          autoFocus={focusEditor}
          value={draft ?? game.readFile(open) ?? ''}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={onEditorKey}
        />
        <div className="edfoot">
          <button type="button" className="btn primary" id="edSave" onClick={save}>
            حفظ
          </button>
          <button type="button" className="btn ghost" id="edClose" onClick={close}>
            إغلاق
          </button>
          <span className="edkey">Ctrl/⌘ + S</span>
        </div>
      </>
    );
  }

  return (
    <section className="col col-files" aria-label="الملفات">
      <div className="col-head">
        <h2>ملفات المشروع</h2>
        <span className="mono" id="repoName">
          {local?.dir ?? ''}
        </span>
      </div>
      <ul className="files" id="files" hidden={!local}>
        {files.map((f) => (
          <li key={f.path}>
            <button type="button" aria-current={open === f.path ? 'true' : undefined} onClick={() => pick(f.path)}>
              <span>{f.path}</span>
              {f.badge && (
                <span className={'badge ' + f.badge.kind} title={f.badge.title}>
                  {f.badge.code}
                </span>
              )}
            </button>
          </li>
        ))}
      </ul>
      <div className="editor" id="editor">
        {editor}
      </div>
    </section>
  );
}
