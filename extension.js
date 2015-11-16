var vscode_1 = require('vscode');
var parinfer_1 = require('./parinfer');
var Mode;
(function (Mode) {
    Mode[Mode["Paren"] = 0] = "Paren";
    Mode[Mode["Indent"] = 1] = "Indent";
})(Mode || (Mode = {}));
function debounce(fn, delay) {
    var timer;
    return function () {
        var args = [];
        for (var _i = 0; _i < arguments.length; _i++) {
            args[_i - 0] = arguments[_i];
        }
        clearTimeout(timer);
        timer = setTimeout(function () { return fn.apply(void 0, args); }, delay);
    };
}
function fromEditorPosition(editorPosition) {
    if (!editorPosition) {
        return null;
    }
    return { row: editorPosition.line, column: editorPosition.character };
}
function shouldRun(fileName) {
    return /\.clj$/.test(fileName);
}
function activate(context) {
    var modes = Object.create(null);
    var statusBarItem = vscode_1.window.createStatusBarItem(vscode_1.StatusBarAlignment.Right);
    statusBarItem.show();
    function render(editor) {
        var uri = editor.document.uri.toString();
        statusBarItem.text = modes[uri] === Mode.Indent ? 'Indent' : 'Paren';
    }
    function toggleMode() {
        var uri = vscode_1.window.activeTextEditor.document.uri.toString();
        modes[uri] = modes[uri] === Mode.Indent ? Mode.Paren : Mode.Indent;
        render(vscode_1.window.activeTextEditor);
    }
    function parinfer(editor, position) {
        if (position === void 0) { position = null; }
        var document = editor.document;
        var uri = document.uri.toString();
        var input = document.getText();
        var fn = (modes[uri] === Mode.Paren || !position) ? parinfer_1.parenMode : parinfer_1.indentMode;
        var output = position ? fn(input, fromEditorPosition(position)) : fn(input);
        if (typeof output !== 'string') {
            console.log('got from parinfer:', output);
            return;
        }
        var range = new vscode_1.Range(new vscode_1.Position(0, 0), document.positionAt(input.length));
        editor.edit(function (builder) { return builder.replace(range, output); });
        console.log('success');
    }
    var eventuallyParinfer = debounce(parinfer, 50);
    function onSelectionChange(_a) {
        var textEditor = _a.textEditor;
        if (!shouldRun(textEditor.document.fileName)) {
            return;
        }
        eventuallyParinfer(textEditor, textEditor.selection.active);
    }
    function onEditorChange(editor) {
        if (!shouldRun(editor.document.fileName)) {
            return;
        }
        parinfer(editor);
        render(editor);
    }
    context.subscriptions.push(vscode_1.commands.registerCommand('parinfer.toggleMode', toggleMode), vscode_1.window.onDidChangeTextEditorSelection(onSelectionChange), vscode_1.window.onDidChangeActiveTextEditor(onEditorChange));
    render(vscode_1.window.activeTextEditor);
}
exports.activate = activate;
//# sourceMappingURL=extension.js.map