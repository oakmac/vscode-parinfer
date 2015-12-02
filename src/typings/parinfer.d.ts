declare module "parinfer" {
	interface IPosition {
		cursorLine: number;
		cursorX: number;
	}
	
	interface IParenResult {
		text: string;
		isValid: boolean;
		state: Object;
	}

	export function indentMode(contents: string, cursor?: IPosition): IParenResult;
	export function parenMode(contents: string, cursor?: IPosition): IParenResult;
}
