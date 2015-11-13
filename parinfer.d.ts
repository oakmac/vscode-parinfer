export interface IPosition {
	row: number;
	column: number;
}

export function indentMode(contents: string, cursor?: IPosition);
export function parenMode(contents: string, cursor?: IPosition);