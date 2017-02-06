import {
  TextEditor,
	TextEditorSelectionChangeEvent,
	TextEditorSelectionChangeKind,
  Position,
  Range,
  Selection,
  window
} from "vscode";

import { indentMode, parenMode, IPosition } from "parinfer";
import { EditorStates, EditorState } from "editor";
import { editorStates, getEditorRange } from "./editor";
import { map, splitLines, noop, findEndRow, findStartRow, linesDiff } from "./utils";
import { parenModeFailedMsg, parenModeChangedFileMsg } from "./messages";

function _applyParinfer(editor: TextEditor, event: TextEditorSelectionChangeEvent, mode: EditorState) {

	if (event && event.kind !== TextEditorSelectionChangeKind.Keyboard) {
		return;
	}

	const currentText = editor.document.getText();
	const lines = splitLines(currentText);

	if (lines[lines.length - 1] !== "") {
		lines.push("");
	}

	const cursors = event ? event.selections : editor.selections;
	const cursor = event ? event.selections[0].active : editor.selection.active;
	const line = cursor.line;
	const multipleCursors = cursors.length > 1;
	const isSelection = (event ? event.selections[0].isEmpty : editor.selection.isEmpty) === false;
	const singleCursor = !(isSelection || multipleCursors);
	const startRow = findStartRow(lines, line);
	const endRow = findEndRow(lines, line);
	const opts: IPosition = {
		cursorLine: line - startRow,
		cursorX: cursor.character
	};
	const linesToInfer = lines.slice(startRow, endRow);
	const textToInfer = linesToInfer.join("\n") + "\n";
	const result = mode === "paren-mode" ? parenMode(textToInfer, opts) : indentMode(textToInfer, opts);
	const parinferSuccess = result.success;
	const inferredText = parinferSuccess ? result.text : false;

	if (typeof inferredText === "string" && inferredText !== textToInfer) {
		editor.edit((edit) => {
			edit.replace(
				new Range(new Position(startRow, 0), new Position(endRow, 0)),
				inferredText);
		}, {
			undoStopAfter: false,
			undoStopBefore: false
		})
		.then((applied) => {
			if (applied) {
				const cursor = editor.selection.active;
				const nextCursor = cursor.with(cursor.line, result.cursorX);
				editor.selection = new Selection(nextCursor, nextCursor);
			}
		});
	}
}

export function parinfer(editor: TextEditor) {

	let shouldInit = editor.document.languageId === "clojure";

	editorStates.update((states: EditorStates) => {

		const state = states.get(editor);

		if (!state && !shouldInit) {
			return states.set(editor, state);
		} else if (!state) {
			return states.set(editor, "disabled");
		} else {
			shouldInit = false;
			return states.set(editor, state);
		}
	});

	if (shouldInit) {
		const showOpenFileDialog = true;
		const currentFile = editor.document.fileName;
		const currentText = editor.document.getText();
		const parenModeResult = parenMode(currentText);
		const parenModeSucceeded = parenModeResult.success === true;
		const parenModeText = parenModeResult.text;
		const textDelta = linesDiff(currentText, parenModeText);
		const parenModeChangedFile = parenModeSucceeded && textDelta.diff !== 0;

		if (!parenModeSucceeded && showOpenFileDialog) {
			window.showInformationMessage(parenModeFailedMsg(currentFile), "Ok")
				.then((btn) => {
					if (btn === "Ok") {
						editorStates.update((states: EditorStates) => states.set(editor, "paren-mode"));
					}
				});
		} else if (!parenModeSucceeded && !showOpenFileDialog) {
			editorStates.update((states: EditorStates) => states.set(editor, "paren-mode"));
		} else if (parenModeChangedFile && showOpenFileDialog) {
			window.showInformationMessage(parenModeChangedFileMsg(currentFile, textDelta.diff), "Yes", "No")
				.then((btn) => {
					if (btn === "Yes") {
						editor.edit((edit) => {
							edit.replace(getEditorRange(editor), parenModeText);
						});
						editorStates.update((states: EditorStates) => states.set(editor, "indent-mode"));
					}
				});
		} else if (parenModeChangedFile && !showOpenFileDialog) {
			editor.edit((edit) => {
				edit.replace(getEditorRange(editor), parenModeText);
			});
			editorStates.update((states: EditorStates) => states.set(editor, "indent-mode"));
		} else {
			editorStates.update((states: EditorStates) => states.set(editor, "indent-mode"));
		}
	}
}
