/// <reference types="@types/bun" />

declare module "*.html" {
	const src: string;
	export default src;
}

declare module "*.svg" {
	const src: string;
	export default src;
}

declare module "*.css";
