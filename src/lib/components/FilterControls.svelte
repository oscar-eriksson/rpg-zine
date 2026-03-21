<script lang="ts">
	import { bwAlgorithms, colorAlgorithms } from '$lib/filterAlgorithms';

	let {
		filterMode = $bindable<'none' | 'color' | 'bw'>('none'),
		bwAlgorithm = $bindable('lighten'),
		colorAlgorithm = $bindable('bleach-warm'),
		filterStrength = $bindable(0),
		exportDpi = $bindable(216)
	}: {
		filterMode: 'none' | 'color' | 'bw';
		bwAlgorithm: string;
		colorAlgorithm: string;
		filterStrength: number;
		exportDpi: number;
	} = $props();

	let algoDropdownOpen = $state(false);

	let currentAlgos = $derived(filterMode === 'bw' ? bwAlgorithms : colorAlgorithms);
	let currentAlgoKey = $derived(filterMode === 'bw' ? bwAlgorithm : colorAlgorithm);
	let currentAlgo = $derived(currentAlgos.find((a) => a.key === currentAlgoKey) ?? currentAlgos[0]);
</script>

<!-- Print Filter -->
<div class="mb-8 space-y-6">
	<div>
		<span class="mb-3 block text-xs font-bold tracking-widest text-slate-500 uppercase"
			>Print Filter</span
		>
		<div class="grid grid-cols-3 gap-2">
			{#each [['none', 'None'], ['color', 'Color'], ['bw', 'B&W']] as const as [mode, label] (mode)}
				<button
					onclick={() => {
						filterMode = mode;
						algoDropdownOpen = false;
					}}
					class="rounded-xl border-2 py-2.5 text-[10px] font-black transition-all {filterMode ===
					mode
						? 'border-purple-500 bg-purple-500/10 text-white'
						: 'border-slate-800 text-slate-600 hover:border-slate-700 hover:text-slate-400'}"
					>{label}</button
				>
			{/each}
		</div>
	</div>

	{#if filterMode !== 'none'}
		<div class="space-y-6">
			<div>
				<span class="mb-3 block text-xs font-bold tracking-widest text-slate-500 uppercase"
					>Algorithm</span
				>
				<div class="relative">
					<button
						onclick={(e) => {
							e.stopPropagation();
							algoDropdownOpen = !algoDropdownOpen;
						}}
						class="flex w-full items-center justify-between gap-2 rounded-xl border border-slate-700 bg-slate-800 px-4 py-3 text-xs font-bold text-slate-300 transition-colors hover:border-slate-600 {algoDropdownOpen
							? 'border-purple-500/50'
							: ''}"
					>
						<span>{currentAlgo.label}</span>
						<svg
							xmlns="http://www.w3.org/2000/svg"
							width="12"
							height="12"
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							stroke-width="2.5"
							stroke-linecap="round"
							stroke-linejoin="round"
							class="text-slate-500 transition-transform {algoDropdownOpen
								? 'rotate-180'
								: ''}"><path d="m6 9 6 6 6-6" /></svg
						>
					</button>
					{#if algoDropdownOpen}
						<div
							class="fixed inset-0 z-40"
							onclick={() => (algoDropdownOpen = false)}
							aria-hidden="true"
						></div>
						<div
							class="absolute top-full right-0 left-0 z-50 mt-1.5 overflow-hidden rounded-xl border border-slate-700 bg-slate-900 shadow-2xl shadow-black/50"
						>
							{#each currentAlgos as algo (algo.key)}
								<button
									onclick={() => {
										if (filterMode === 'bw') bwAlgorithm = algo.key;
										else colorAlgorithm = algo.key;
										algoDropdownOpen = false;
									}}
									class="flex w-full flex-col items-start gap-0 px-4 py-2.5 text-left text-xs font-bold transition-colors
											{currentAlgoKey === algo.key
										? 'border-l-2 border-purple-500 bg-purple-500/10 text-purple-300'
										: 'border-l-2 border-transparent text-slate-400 hover:bg-slate-800 hover:text-slate-200'}"
								>
									<span>{algo.label}</span>
									<span class="mt-0.5 block text-[10px] leading-tight font-normal opacity-50"
										>{algo.desc}</span
									>
								</button>
							{/each}
						</div>
					{/if}
				</div>
			</div>
			<div class="group">
				<div class="mb-4 flex items-center justify-between">
					<label
						for="filter-strength"
						class="text-xs font-bold tracking-widest text-slate-500 uppercase transition-colors group-hover:text-slate-400"
						>{currentAlgo.sliderLabel}</label
					>
					<span class="rounded bg-purple-500/5 px-2 py-0.5 font-mono text-[10px] text-purple-500"
						>{filterStrength}%</span
					>
				</div>
				<input
					id="filter-strength"
					type="range"
					bind:value={filterStrength}
					min="0"
					max="100"
					class="h-1.5 w-full cursor-pointer appearance-none rounded-lg bg-slate-800 accent-purple-500"
				/>
			</div>
		</div>
	{/if}

	<!-- Export Quality — always visible, disabled when no filter -->
	<div class={filterMode !== 'none' ? '' : 'pointer-events-none opacity-40'}>
		<div class="mb-3 flex items-center justify-between">
			<span class="text-xs font-bold tracking-widest text-slate-500 uppercase">Export Quality</span
			>
			{#if filterMode === 'none'}
				<span class="rounded bg-slate-800 px-2 py-0.5 font-mono text-[10px] text-slate-500"
					>Vector ∞ DPI</span
				>
			{/if}
		</div>
		<div class="grid grid-cols-3 gap-2">
			{#each [{ dpi: 144, label: 'Draft' }, { dpi: 216, label: 'Standard' }, { dpi: 288, label: 'High' }] as preset (preset.dpi)}
				<button
					onclick={() => (exportDpi = preset.dpi)}
					disabled={filterMode === 'none'}
					class="flex flex-col items-center gap-0.5 rounded-xl border-2 px-2 py-2 text-[10px] font-black transition-all {exportDpi ===
						preset.dpi && filterMode !== 'none'
						? 'border-purple-500 bg-purple-500/10 text-white'
						: 'border-slate-800 text-slate-600'}"
				>
					<span>{preset.label}</span>
					<span class="font-mono opacity-60">{preset.dpi}dpi</span>
				</button>
			{/each}
		</div>
	</div>
</div>
