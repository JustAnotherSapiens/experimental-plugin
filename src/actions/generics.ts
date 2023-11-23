import {
  Notice, TFile,
  Editor, MarkdownView,
  CachedMetadata, HeadingCache,
  EditorRange, EditorRangeOrCaret,
} from "obsidian";

import { ExperimentalSettings } from "./../settings";


// This must match the ID at manifest.json
export const PLUGIN_ID = "experimental-plugin";


type SettingKey = keyof ExperimentalSettings;

export function getSetting(setting: SettingKey): any {
  return this.app.plugins.plugins[PLUGIN_ID].settings[setting];
}


export function getActiveView(): MarkdownView {
  return this.app.workspace.getActiveViewOfType(MarkdownView);
}


export function getCodeMirrorEditor(view: MarkdownView): CodeMirror.Editor {
  return (view.editor as any).editMode?.editor?.cm?.cm;
}


export type Fold = {from: number, to: number};

export function getFolds(view: MarkdownView): Array<Fold> {
  const foldInfo = (view.currentMode as any).getFoldInfo();
  if (foldInfo) return foldInfo.folds;
  return [];
}

export function applyFolds(view: MarkdownView, folds: Array<Fold>): void {
  (view.currentMode as any).applyFoldInfo({
    folds, lines: view.editor.lineCount()
  });
  (view as any).onMarkdownFold();
}



const metadataProperties = [
  "links",
  "embeds",
  "tags",
  "headings",
  "sections",
  "listItems",
  "frontmatter",
  "frontmatterPosition",
  "frontmatterLinks",
  "blocks",
] as const;
type MetadataProperty = typeof metadataProperties[number];

export async function getActiveFileCache(property?: MetadataProperty) {
  // msDelay: number = 0
  const startTime = window.moment().format("YYYY-MM-DD[T]HH:mm:ss.SSS");

  // Ensure that the file is saved before getting the cache.
  this.app.commands.executeCommandById('editor:save-file');

  // Ensure that the file is indexed before getting the cache.
  await this.app.vault.adapter.read(this.app.workspace.getActiveFile().path);

  // await new Promise(resolve => setTimeout(resolve, msDelay));

  try {
    const currentFile = this.app.workspace.getActiveFile() as TFile;
    if (!currentFile) throw new Error("Couldn't get currentFile");

    const fileCache = this.app.metadataCache.getFileCache(currentFile) as CachedMetadata;
    if (!fileCache) throw new Error("Couldn't get fileCache");

    if (!property) return fileCache;

    const fileProperty = structuredClone(fileCache[property]);
    if (!fileProperty) throw new Error(`Couldn't get file ${property} from cache`);

    return fileProperty;

  } catch (error) {
    console.debug(startTime, "getActiveFileHeadings() failed:", error.message);
  }
}



export function getHeadingIndex(
  fileHeadings: HeadingCache[],
  cursorLine: number,
  snapParent: boolean = false
): number {
  let headingIndex = -1;
  for (let i = fileHeadings.length - 1; i >= 0; i--) {
    if (fileHeadings[i].position.start.line > cursorLine) continue;
    if (fileHeadings[i].position.start.line === cursorLine) headingIndex = i;
    else if (snapParent) headingIndex = i;
    break;
  }
  return headingIndex;
}


export function scrollToCursor(editor: Editor, offset: number = 0): void {
  const cursorPos = editor.getCursor();
  editor.scrollIntoView({
    from: {line: cursorPos.line - offset, ch: 0},
    to: {line: cursorPos.line + offset, ch: 0}
  }, false);
}


export function handleCursorMovement(
  editor: Editor,
  line: number | undefined,
): void {
  if (line === undefined) return;

  if (!editor.somethingSelected()) {
    editor.setCursor({line, ch: 0});
    return;
  }

  let selection: EditorRange = {
    from: editor.getCursor("anchor"),
    to: {line, ch: 0},
  };

  if (this.app.vault.config.vimMode) {
    if (line >= selection.from.line) {
      selection.to.ch = 1;
    }
  }

  editor.transaction({selection});
}





/* NOTICE FUNCTIONS */

export function newMultilinePluginNotice (
  texts: string[],
  style: string,
  duration?: number | undefined
): void {
  const fragment = document.createDocumentFragment();
  texts.forEach((text) => {
    const p = document.createElement("p");
    p.textContent = text;
    p.setAttribute("style", style);
    fragment.appendChild(p);
  });
  const pluginNotice = new Notice(fragment, duration);
  pluginNotice.noticeEl.addClass("experimental-plugin-notice");
}
