import {
	TextEditor,
	Position,
	Range
} from "vscode";

import { Atom } from "utils";
import { EditorStates } from "editor";
import { atom } from "./utils";

export const editorStates: Atom<EditorStates> = atom(new WeakMap());

export function getEditorRange(editor: TextEditor) {
	const line = editor.document.lineCount - 1;
	const character = editor.document.lineAt(line).text.length;
	return new Range(new Position(0, 0), new Position(line, character));
}