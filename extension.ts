import { Range, Position, TextEditor, ExtensionContext, commands, window } from 'vscode'; 
import { indentMode, parenMode, IPosition } from './parinfer';

function fromEditorPosition(editorPosition: Position): IPosition {
	return { row: editorPosition.line, column: editorPosition.character }; 
}

export function activate(context: ExtensionContext) {
	console.log('activated!');
	
	function parinfer() {
		const editor = window.activeTextEditor;
		const document = editor.document;
		const input = document.getText();
		const output = indentMode(input, fromEditorPosition(editor.selection.active));
		
		if (typeof output !== 'string') {
			console.log('got from parinfer:', output);
			return;
		}
		
		const range = new Range(new Position(0, 0), editor.document.positionAt(input.length));
		editor.edit(builder => builder.replace(range, output));
		console.log('success');
	}

	var disposable = commands.registerCommand('extension.sayHello', parinfer);
	
	window.onDidChangeTextEditorSelection(e => {
		const document = e.textEditor.document;
		if (!/\.clj$/.test(document.fileName)) {
			return;
		}
		
		parinfer();
	}, context.subscriptions);
	
	// window.onDidChangeActiveTextEditor(onEditor, context.subscriptions);
}