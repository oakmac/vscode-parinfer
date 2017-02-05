(ns vscode-parinfer.core)

(def vscode (js/require "vscode"))

(def editorStates (atom {}))
;; :disabled
;; :indent-mode
;; :paren-mode

(defn parenModeFailedMsg [currentFile]
  (str "Parinfer was unable to parse " currentFile ".\n"
       "It is likely that this file has unbalanced parentheses and will not compile.\n"
       "Parinfer will enter Paren Mode so you may fix the problem. Press Ctrl + ( to switch to Indent Mode once the file is balanced."))

(defn parenModeChangedFileMsg [currentFile diff]
  (str "Parinfer needs to make some changes to " currentFile "before enabling Indent Mode.\n"
       "These changes will only affect whitespace and indentation; the structure of the file will be unchanged.\n"
       diff (if (= diff 1) "line" "lines") " will be affected.\n"
       "Would you like Parinfer to modify the file? (recommended)"))

(defn getEditorRange [editor]
  (let [lineNo (dec editor.document.lineCount)
        line (editor.document.lineAt lineNo)
        charNo line.text.length]
    (vscode.Range.
      (vscode.Position. 0 0)
      (vscode.Position. lineNo charNo))))

(defn activate [context]
  (initStatusBar "parinfer.toggleMode")
  (activatePane vscode.window.activeTextEditor)
  (context.subscriptions.push
    (vscode.commands.registerCommand "parinfer.toggleMode"
      #(toggleMode vscode.window.activeTextEditor))
    (vscode.commands.registerCommand "parinfer.disable"
      #(disableParinfer vscode.window.activeTextEditor))
    (vscode.window.onDidChangeTextEditorSelection
      (fn [event]
        (applyParinfer vscode.window.activeTextEditor event)))
    (vscode.window.onDidChangeActiveTextEditor activatePane)))

(defn deactivate []
  nil)

(set! js/module.exports
  #js{:activate activate
      :deactivate deactivate})

(set! *main-cli-fn* (fn [] nil))
