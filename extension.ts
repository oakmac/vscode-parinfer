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
	return /\.clj$/.test(fileName);
}

export function activate(context: ExtensionContext) {
	let modes: { [uri: string]: Mode; } = Object.create(null);
	
	const statusBarItem = window.createStatusBarItem(StatusBarAlignment.Right);
	statusBarItem.show();
	
	function render(editor: TextEditor) {
		const uri = editor.document.uri.toString();
		statusBarItem.text = modes[uri] === Mode.Indent ? 'Indent' : 'Paren';
	}

	function toggleMode() {
		const uri = window.activeTextEditor.document.uri.toString();
		modes[uri] = modes[uri] === Mode.Indent ? Mode.Paren : Mode.Indent;
		render(window.activeTextEditor);
	}
	
	function parinfer(editor: TextEditor, position: Position = null) {
		const document = editor.document;
		const uri = document.uri.toString();
		const input = document.getText();
		const fn = (modes[uri] === Mode.Indent && position) ? indentMode : parenMode;
		const output = position ? fn(input, fromEditorPosition(position)) : fn(input);
		
		if (typeof output !== 'string') {
			console.log('got from parinfer:', output);
			return;
		}
		
		const range = new Range(new Position(0, 0), document.positionAt(input.length));
		editor.edit(builder => builder.replace(range, output));
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
		render(editor);
	}
	
	context.subscriptions.push(
		commands.registerCommand('parinfer.toggleMode', toggleMode),
		window.onDidChangeTextEditorSelection(onSelectionChange),
		window.onDidChangeActiveTextEditor(onEditorChange)
	);
	
	render(window.activeTextEditor);
}