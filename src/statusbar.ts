import {
	Range,
	Position,
	Selection,
	TextEditor,
	ExtensionContext,
	commands,
	window,
	StatusBarAlignment,
	StatusBarItem
} from "vscode";

import { Atom } from "utils";
import { EditorState } from "editor";
import { atom } from "./utils";

export const statusBarItem: Atom<StatusBarItem> = atom();

export function initStatusBar(cmd: string) {

  const sbItem = window.createStatusBarItem(StatusBarAlignment.Right);

	sbItem.command = cmd;
	sbItem.show();

  statusBarItem.update(() => sbItem);
}

function setStatusDisabledIndicator(statusBarItem: StatusBarItem) {
	statusBarItem.text = "$(code)";
	statusBarItem.color = "#cccccc";
	statusBarItem.tooltip = "Parinfer is disabled";
}

function setStatusIndicator(statusBarItem: StatusBarItem, state: EditorState) {
	const mode = state === "indent-mode" ? "Indent" : "Paren";
	statusBarItem.text = `$(code) ${ mode }`;
	statusBarItem.color = "#ffffff";
	statusBarItem.tooltip = `Parinfer is in ${ mode } mode`;
}

export function updateStatusBar(state?: EditorState) {
  const sbItem = statusBarItem.deref();
	if (typeof state !== "string") {
		sbItem.hide();
	} else if (state === "disabled") {
		setStatusDisabledIndicator(sbItem);
		sbItem.show();
	} else {
		setStatusIndicator(sbItem, state);
		sbItem.show();
	}
}