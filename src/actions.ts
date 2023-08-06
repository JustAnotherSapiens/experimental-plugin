import { Editor, Notice } from "obsidian";


/* NOTICE FUNCTIONS */

export function newMultilinePluginNotice (
  texts: string[], style: string, duration?: number | undefined
) {
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


export function showCurrentDateAndTime() {
  newMultilinePluginNotice([
    window.moment().format("dddd ([UTC]Z)"),
    window.moment().format("YYYY-MM-DD HH:mm:ss.SSS"),
    // window.moment().format("ddd YYYY-MM-DD HH:mm:ss Z"),
  ], "font-size: 1em; font-style: italic; text-align: center;", 0);
}


/* EDITOR FUNCTIONS */

export function smartStrikethrough(editor: Editor, linewise: boolean = true) {

  // Full-line selection range (if any), cursor line range otherwise
  const editRange = {
    from: {line: editor.getCursor("from").line, ch: 0},
    to: {
      line: editor.getCursor("to").line,
      ch: editor.getLine(editor.getCursor("to").line).length
    },
  }

  // Get text to edit
  const isSingleLine = editRange.from.line === editRange.to.line;
  const oneLineSelection = isSingleLine && editor.somethingSelected();
  const editText = oneLineSelection ?
                   editor.getSelection() :
                   editor.getRange(editRange.from, editRange.to);

  let changes = [];
  let endCursorPos = editRange.from;

  // Unstrike
  if (editText.match(/~~/)) {
    changes.push({text: editText.replace(/~~/g, ""), ...editRange});
  }

  // Strike single line selection
  else if (oneLineSelection || !linewise) {
    changes.push({
      text: editText.replace(/^(\s*)(.*?)(\s*)$/, "$1~~$2~~$3"),
      from: editor.getCursor("from"),
      to: editor.getCursor("to"),
    });
    endCursorPos = editor.getCursor();
    endCursorPos.ch += 4; // To account for the added tildes (~~~~)
  }

  // Smart strike
  else {
    let regex = /^((?:\s*>{1,6} )?\s*(?:(?:[-*+]|\d{1,6}\.) )?\s*)(.*?)(\s*)$/;
    let lines = editText.split('\n');
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].trim() === '') continue;
      else {
        lines[i] = lines[i].replace(regex, "$1~~$2~~$3");
      }
    }
    changes.push({text: lines.join('\n'), ...editRange});
  }

  // Execute changes
  editor.transaction({changes, selection: {from: endCursorPos}});

}

