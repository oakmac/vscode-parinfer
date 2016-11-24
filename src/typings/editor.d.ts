declare module "editor" {
  
  import {
    TextEditor
  } from "vscode";

  type EditorState = "disabled" | "paren-mode" | "indent-mode";
  type EditorStates = WeakMap<TextEditor, EditorState>;
}