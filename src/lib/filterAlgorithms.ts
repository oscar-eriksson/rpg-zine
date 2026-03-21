export type Algorithm = {
	key: string;
	label: string;
	sliderLabel: string;
	desc: string;
	filter: (t: number) => string;
};

export const bwAlgorithms: Algorithm[] = [
	{
		key: 'lighten',
		label: 'Lighten',
		sliderLabel: 'Brightness',
		desc: 'Brightens uniformly. Safe starting point.',
		filter: (t: number) => `grayscale(1) brightness(${1 + t})`
	},
	{
		key: 'bleach',
		label: 'Bleach Out',
		sliderLabel: 'Intensity',
		desc: 'Blows out lights, keeps darks crisp. Great for backgrounds.',
		filter: (t: number) => `grayscale(1) brightness(${1 + t * 0.5}) contrast(${1 + t * 1.2})`
	},
	{
		key: 'high-contrast',
		label: 'High Contrast',
		sliderLabel: 'Contrast',
		desc: 'Pushes grays to black or white. Bold, graphic look.',
		filter: (t: number) => `grayscale(1) contrast(${1 + t * 2.5})`
	},
	{
		key: 'newsprint',
		label: 'Newsprint',
		sliderLabel: 'Exposure',
		desc: 'Punchy contrast with slight exposure boost. Classic print feel.',
		filter: (t: number) => `grayscale(1) contrast(${1.4 + t * 0.8}) brightness(${1.1 + t * 0.25})`
	},
	{
		key: 'overexpose',
		label: 'Overexpose',
		sliderLabel: 'Wash',
		desc: 'Aggressively washes out mid-tones. Saves ink.',
		filter: (t: number) => `grayscale(1) brightness(${1 + t * 2}) contrast(0.8)`
	},
	{
		key: 'sepia',
		label: 'Sepia',
		sliderLabel: 'Brightness',
		desc: 'Warm brownish tone. Vintage or aged document feel.',
		filter: (t: number) => `sepia(1) brightness(${1 + t * 0.8})`
	},
	{
		key: 'invert',
		label: 'Invert (Dark BG)',
		sliderLabel: 'Brightness',
		desc: 'White-on-black. For designs with dark backgrounds.',
		filter: (t: number) => `grayscale(1) invert(1) brightness(${1 + t * 0.5})`
	}
];

export const colorAlgorithms: Algorithm[] = [
	{
		key: 'bleach-warm',
		label: 'Bleach Warm',
		sliderLabel: 'Intensity',
		desc: 'Washes out yellow/warm backgrounds toward white.',
		filter: (t: number) =>
			`brightness(${1 + t * 0.6}) saturate(${Math.max(0, 1 - t * 0.7).toFixed(2)}) contrast(${1 + t * 0.1})`
	},
	{
		key: 'vivid',
		label: 'Vivid',
		sliderLabel: 'Punch',
		desc: 'Boosts saturation and contrast. Pops flat colors.',
		filter: (t: number) => `saturate(${1 + t * 2}) contrast(${1 + t * 0.4})`
	},
	{
		key: 'cool',
		label: 'Cool',
		sliderLabel: 'Amount',
		desc: 'Shifts hues cooler. Reduces warm or yellow cast.',
		filter: (t: number) => `hue-rotate(${(t * 20).toFixed(1)}deg) brightness(${1 + t * 0.05})`
	},
	{
		key: 'warm',
		label: 'Warm',
		sliderLabel: 'Amount',
		desc: 'Shifts hues warmer. Adds a golden tone to cool images.',
		filter: (t: number) =>
			`hue-rotate(${(-t * 15).toFixed(1)}deg) saturate(${1 + t * 0.4}) brightness(${1 + t * 0.05})`
	}
];
