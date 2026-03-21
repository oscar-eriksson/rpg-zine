import { browser } from '$app/environment';

export type Prefs = {
	A5?: { printerMargin: number; middleMargin: number };
	A6?: { printerMargin: number; middleMargin: number };
	filterMode?: 'none' | 'color' | 'bw';
	bwAlgorithm?: string;
	colorAlgorithm?: string;
	filterStrength?: number;
};

const PREFS_KEY = 'rpg-zine-prefs';

export function loadPrefs(): Prefs {
	if (!browser) return {};
	try {
		return JSON.parse(localStorage.getItem(PREFS_KEY) ?? '{}');
	} catch {
		return {};
	}
}

export function savePrefs(patch: Partial<Prefs>) {
	if (!browser) return;
	try {
		localStorage.setItem(PREFS_KEY, JSON.stringify({ ...loadPrefs(), ...patch }));
	} catch {
		/* ignore quota/private-browsing errors */
	}
}
