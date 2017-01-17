(ns vscode-parinfer.core)

(def vscode (js/require "vscode"))

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
