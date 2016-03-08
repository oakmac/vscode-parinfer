'use strict';

import {
	Range, Position, TextEditor, ExtensionContext,
	commands, window, StatusBarAlignment,
	TextEditorSelectionChangeEvent
} from 'vscode';
import { indentMode, parenMode, IPosition } from './parinfer';

enum Mode {
	Paren,
	Indent
}

function debounce(fn: (...args) => void, delay: number): (...args)=>void {
	let timer;
	return (...args) => {
		clearTimeout(timer);
		timer = setTimeout(() => fn(...args), delay);
	};
}

function fromEditorPosition(editorPosition: Position): IPosition {
	if (!editorPosition) {
		return null;
	}

	return { row: editorPosition.line, column: editorPosition.character };
}

function shouldRun(fileName: string): boolean {
	return /\.clj[csx]?$|build\.boot$/.test(fileName);
}

export function activate(context: ExtensionContext) {
	let enabled = true;
	let modes: { [uri: string]: Mode; } = Object.create(null);

	function getMode(uri: string) {
		return modes[uri] || Mode.Paren;
	}

	const statusBarItem = window.createStatusBarItem(StatusBarAlignment.Right);
	statusBarItem.show();
	statusBarItem.command = 'parinfer.switchState';

	function render(editor: TextEditor) {
		const uri = editor.document.uri.toString();

		if (!shouldRun(editor.document.fileName)) {
			statusBarItem.hide();
			return;
		}

		if (!enabled) {
			statusBarItem.text = '$(code)';
			statusBarItem.color = '#ccc';
			statusBarItem.tooltip = 'Parinfer is disabled';
		} else {
			const mode = getMode(uri) === Mode.Indent ? 'Indent' : 'Paren';
			statusBarItem.text = `$(code) ${ mode }`;
			statusBarItem.color = 'white';
			statusBarItem.tooltip = `Parinfer is in ${ mode } mode`;
		}

		statusBarItem.show();
	}

	function toggleMode() {
		const uri = window.activeTextEditor.document.uri.toString();
		modes[uri] = getMode(uri) === Mode.Indent ? Mode.Paren : Mode.Indent;
		render(window.activeTextEditor);
	}

	function toggleEnablement() {
		enabled = !enabled;
		render(window.activeTextEditor);
	}

	function switchState() {
		const uri = window.activeTextEditor.document.uri.toString();

		if (!enabled) {
			enabled = true;
		} else if (getMode(uri) === Mode.Paren) {
			modes[uri] = Mode.Indent;
		} else {
			modes[uri] = Mode.Paren;
			enabled = false;
		}

		render(window.activeTextEditor);
	}

	function parinfer(editor: TextEditor, position: Position = null) {
		const document = editor.document;
		const uri = document.uri.toString();
		const input = document.getText();
		const fn = (getMode(uri) === Mode.Indent && position) ? indentMode : parenMode;
		const output = position ? fn(input, fromEditorPosition(position)) : fn(input);

		if (typeof output !== 'string') {
			return;
		}

		const range = new Range(new Position(0, 0), document.positionAt(input.length));
		editor.edit(builder => builder.replace(range, output));
	}

	const eventuallyParinfer = debounce(parinfer, 50);

	function onSelectionChange({ textEditor }: TextEditorSelectionChangeEvent) {
		if (!enabled || !shouldRun(textEditor.document.fileName)) {
			return;
		}

		eventuallyParinfer(textEditor, textEditor.selection.active);
	}

	function onEditorChange(editor: TextEditor) {
		if (!shouldRun(editor.document.fileName)) {
			render(editor);
			return;
		}

		if (!enabled) {
			return;
		}

		parinfer(editor);
		render(editor);
	}

	context.subscriptions.push(
		commands.registerCommand('parinfer.toggleMode', toggleMode),
		commands.registerCommand('parinfer.toggleEnablement', toggleEnablement),
		commands.registerCommand('parinfer.switchState', switchState),
		window.onDidChangeTextEditorSelection(onSelectionChange),
		window.onDidChangeActiveTextEditor(onEditorChange)
	);

	render(window.activeTextEditor);
}