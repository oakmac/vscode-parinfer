(ns vscode-parinfer.core)

(def vscode (js/require "vscode"))

(defn activate []
  (js/console.log "Hello World"))

(defn deactivate []
  (js/console.log "Goodbye World"))

(set! js/module.exports
  #js{:activate activate
      :deactivate deactivate})

(set! *main-cli-fn* (fn [] nil))
