// canonicalLevel resolves nonstandard level names (warn, err, ...) to the
// canonical set used for badge colors and chart hues.
export function canonicalLevel(
	level: string,
	aliases: Record<string, string>,
): string {
	const lower = level.toLowerCase();
	return aliases[lower] ?? lower;
}
