declare module "parinfer" {
	interface IPosition {
		cursorLine: number;
		cursorX: number;
		previewCursorScope?: boolean;
	}

	interface ChangedLine {
		lineNo: number;
		line: string;
	}

	type ErrorName =
		"quote-danger" |
		"eol-backslash" |
		"unclosed-quote" |
		"unclosed-paren" |
		"unmatched-close-paren" |
		"unhandled";

	type OpenCharacter = "(" | "[" | "{";

	interface TabStop {
		x: number;
		lineNo: number;
		ch: OpenCharacter;
	}

	interface Error {
		name: ErrorName;
		message: string;
		lineNo: number;
		x: number;
		tabStops: Array<TabStop>
	}
	
	interface IParenResult {
		text: string;
		cursorX: number;
		success: boolean;
		error: Error;
		changedLines: Array<ChangedLine>;
	}

	export function indentMode(contents: string, cursor?: IPosition): IParenResult;
	export function parenMode(contents: string, cursor?: IPosition): IParenResult;
}
