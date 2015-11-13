import {
	Range, Position, TextEditor, ExtensionContext,
	commands, window, StatusBarAlignment,
	TextEditorSelectionChangeEvent 
} from 'vscode'; 
import { indentMode, parenMode, IPosition } from './parinfer';

function fromEditorPosition(editorPosition: Position): IPosition {
	return { row: editorPosition.line, column: editorPosition.character }; 
}

enum Mode {
	Paren,
	Indent
}

export function activate(context: ExtensionContext) {
	let mode: Mode = Mode.Paren;
	
	const statusBarItem = window.createStatusBarItem(StatusBarAlignment.Right);
	statusBarItem.show();
	
	function render() {
		statusBarItem.text = mode === Mode.Paren ? 'Paren' : 'Indent';
	}

	function toggleMode() {
		mode = mode === Mode.Paren ? Mode.Indent : Mode.Paren;
		render();
	}
	
	function parinfer(editor: TextEditor) {
		const document = editor.document;
		const input = document.getText();
		const fn = mode === Mode.Paren ? parenMode : indentMode;
		const output = fn(input, fromEditorPosition(editor.selection.active));
		
		if (typeof output !== 'string') {
			console.log('got from parinfer:', output);
			return;
		}
		
		const range = new Range(new Position(0, 0), editor.document.positionAt(input.length));
		editor.edit(builder => builder.replace(range, output));
		console.log('success');
	}
	
	function onSelectionChange(e: TextEditorSelectionChangeEvent) {
		if (!/\.clj$/.test(e.textEditor.document.fileName)) {
			return;
		}
		
		parinfer(e.textEditor);
	}
	
	context.subscriptions.push(
		commands.registerCommand('parinfer.toggleMode', toggleMode),
		window.onDidChangeTextEditorSelection(onSelectionChange)
	);
	
	render();
}