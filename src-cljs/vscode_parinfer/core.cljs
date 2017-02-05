(ns vscode-parinfer.core
  (:require
    [goog.functions :refer [debounce]]))

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

;; NOTE: this is the "parent expression" hack
;; https://github.com/oakmac/atom-parinfer/issues/9
(defn- is-parent-expression-line?
  [line]
  (and (string? line)
       (.match line #"^\([a-zA-Z]")))

(defn- find-start-row
  "Returns the index of the first line we need to send to Parinfer."
  [lines cursor-idx]
  (if
    ;; on the first line?
    (zero? cursor-idx) 0
    ;; else "look up" until we find the closest parent expression
    (loop [idx (dec cursor-idx)]
      (if (or (zero? idx)
              (is-parent-expression-line? (nth lines idx false)))
        idx
        (recur (dec idx))))))

(defn- find-end-row
  "Returns the index of the last line we need to send to Parinfer."
  [lines cursor-idx]
  (let [cursor-plus-1 (inc cursor-idx)
        cursor-plus-2 (inc cursor-plus-1)
        max-idx (dec (count lines))]
    ;; are we near the last line?
    (if (or (== max-idx cursor-idx)
            (== max-idx cursor-plus-1)
            (== max-idx cursor-plus-2))
      ;; if so, just return the max idx
      max-idx
      ;; else "look down" until we find the start of the next parent expression
      (loop [idx cursor-plus-2]
        (if (or (== idx max-idx)
                (is-parent-expression-line? (nth lines idx false)))
          idx
          (recur (inc idx)))))))

(defn split-lines
  "Same as clojure.string/split-lines, except it doesn't remove empty lines at
  the end of the text."
  [text]
  (vec (.split text #"\r?\n")))

(defn lines-diff
  "Returns a map {:diff X, :same Y} of the difference in lines between two texts.
   NOTE: this is probably a reinvention of clojure.data/diff"
  [text-a text-b]
  (let [vec-a (split-lines text-a)
        vec-b (split-lines text-b)
        v-both (map vector vec-a vec-b)
        initial-count {:diff 0, :same 0}]
    (reduce (fn [running-count [line-a line-b]]
              (if (= line-a line-b)
                (update-in running-count [:same] inc)
                (update-in running-count [:diff] inc)))
            initial-count
            v-both)))

(defn getEditorRange [editor]
  (let [lineNo (dec editor.document.lineCount)
        line (editor.document.lineAt lineNo)
        charNo line.text.length]
    (vscode.Range.
      (vscode.Position. 0 0)
      (vscode.Position. lineNo charNo))))

(def statusBarItem (atom nil))

(defn initStatusBar [cmd]
  (let [sbItem (vscode.window.createStatusBarItem
                 vscode.StatusBarAlignment.Right)]
    (set! sbItem.command cmd)
    (sbItem.show)
    (reset! statusBarItem sbItem)))

(defn setStatusIndicator [statusBarItem state]
  (when state
    (let [disabled? (= :disabled state)
          mode ({:indent-mode "Indent" :paren-mode "Paren"} state)]
      (set! statusBarItem.text (str "$(code) " mode))
      (set! statusBarItem.color (if disabled? "#ccc" "#fff"))
      (set! statusBarItem.tooltip
        (if disabled?
          "Parinfer is disabled"
          (str "Parinfer is in " mode " mode"))))))

(defn updateStatusBar [state]
  (let [sbItem @statusBarItem]
    (setStatusIndicator sbItem state)
    (if state
      (sbItem.show)
      (sbItem.hide))))

(add-watch editorStates :foo
  (fn [_key _ref _old _new]
    (let [editor vscode.window.activeTextEditor
          states (get _new editor)]
      (cond
        (and editor state)
        (when (#{:indent-mode :paren-mode} state)
          (applyParinfer editor))

        editor
        (updateStatusBar)))))

(defn toggleMode [editor]
  (swap! editorStates update editor
    {:indent-mode :paren-mode
     :paren-mode :indent-mode}))

(defn activatePane [editor]
  (when editor
    (parinfer editor)))

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
