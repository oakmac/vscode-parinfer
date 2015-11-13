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

function debounce(fn: (...args: any[]) => void, delay: number): (...args: any[])=>void {
	let timer;
	return (...args: any[]) => {
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
	return /\.clj$/.test(fileName);
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
	
	function parinfer(editor: TextEditor, position: Position = null) {
		const document = editor.document;
		const input = document.getText();
		const fn = (mode === Mode.Paren || !position) ? parenMode : indentMode;
		const output = fn(input, fromEditorPosition(position));
		
		if (typeof output !== 'string') {
			console.log('got from parinfer:', output);
			return;
		}
		
		const range = new Range(new Position(0, 0), document.positionAt(input.length));
		editor.edit(builder => builder.replace(range, output));
		console.log('success');
	}
	
	const eventuallyParinfer = debounce(parinfer, 50);
	
	function onSelectionChange({ textEditor }: TextEditorSelectionChangeEvent) {
		if (!shouldRun(textEditor.document.fileName)) {
			return;
		}
		
		eventuallyParinfer(textEditor, textEditor.selection.active);
	}
	
	function onEditorChange(editor: TextEditor) {
		if (!shouldRun(editor.document.fileName)) {
			return;
		}
		
		parinfer(editor);
	}
	
	context.subscriptions.push(
		commands.registerCommand('parinfer.toggleMode', toggleMode),
		window.onDidChangeTextEditorSelection(onSelectionChange),
		window.onDidChangeActiveTextEditor(onEditorChange)
	);
	
	render();
}