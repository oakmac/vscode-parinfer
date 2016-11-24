import {
	Range,
	Position,
	Selection,
	TextEditor,
	ExtensionContext,
	commands,
	window
} from "vscode";

import { EditorStates, EditorState } from "editor";
import { initStatusBar, updateStatusBar } from "./statusbar";
import { editorStates } from "./editor";
import { disableParinfer, applyParinfer, parinfer } from "./parinfer";

editorStates.addWatch((states: EditorStates) => {
	const editor = window.activeTextEditor;
	const currentEditorState = states.get(editor);

	if (editor && currentEditorState) {
		updateStatusBar(currentEditorState);
		if (currentEditorState === "indent-mode" ||
		    currentEditorState === "paren-mode") {
			applyParinfer(editor);
		}
	} else if (editor) {
		updateStatusBar();
	}
});

function toggleMode(editor: TextEditor) {
	editorStates.update((states: EditorStates) => {
		const nextState: EditorState  = states.get(editor) === "paren-mode" ? "indent-mode" : "paren-mode";
		return states.set(editor, nextState);
	});
}

function activatePane(editor?: TextEditor) {
	if (editor) {
		parinfer(editor);
	}
}

export function activate(context: ExtensionContext) {

	initStatusBar("parinfer.toggleMode");

	activatePane(window.activeTextEditor);

	context.subscriptions.push(
		commands.registerCommand("parinfer.toggleMode", () => {
			toggleMode(window.activeTextEditor);
		}),
		commands.registerCommand("parinfer.disable", () => {
			disableParinfer(window.activeTextEditor);
		}),
		window.onDidChangeTextEditorSelection(() => {
			applyParinfer(window.activeTextEditor);
		}),
		window.onDidChangeActiveTextEditor(activatePane)
	);
}