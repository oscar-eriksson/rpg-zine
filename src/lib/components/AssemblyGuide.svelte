<script lang="ts">
	let { size, duplex } = $props<{ size: 'A5' | 'A6', duplex: boolean }>();
</script>

<div class="bg-slate-900 border border-slate-700/50 p-6 rounded-2xl">
	<h3 class="text-sm font-bold text-slate-400 mb-4 uppercase tracking-wider">How to Assemble</h3>
	
	<div class="flex flex-col gap-6">
		<div class="flex gap-4 items-start">
			<div class="w-8 h-8 rounded-full bg-purple-500/20 text-purple-400 flex items-center justify-center font-bold shrink-0">1</div>
			<div>
				<p class="text-sm font-medium text-slate-200">Print</p>
				<p class="text-xs text-slate-500 mt-1">
					{#if duplex}
						Select <strong>Duplex (Double Sided)</strong>. Flip on <strong>Long Edge</strong>.
					{:else}
						Print all pages single-sided.
					{/if}
				</p>
			</div>
		</div>

		{#if size === 'A6'}
			<div class="flex gap-4 items-start">
				<div class="w-8 h-8 rounded-full bg-purple-500/20 text-purple-400 flex items-center justify-center font-bold shrink-0">2</div>
				<div>
					<p class="text-sm font-medium text-slate-200">Cut</p>
					<p class="text-xs text-slate-500 mt-1">
						Cut each A4 sheet in half horizontally (at 148.5mm) to get two A5 stacks.
					</p>
				</div>
			</div>
		{/if}

		<div class="flex gap-4 items-start">
			<div class="w-8 h-8 rounded-full bg-purple-500/20 text-purple-400 flex items-center justify-center font-bold shrink-0">{size === 'A6' ? '3' : '2'}</div>
			<div>
				<p class="text-sm font-medium text-slate-200">Fold & Bind</p>
				<p class="text-xs text-slate-500 mt-1">
					Stack the sheets in order, fold in half, and staple along the spine (saddle stitch).
				</p>
			</div>
		</div>
	</div>

	<!-- Visual Guide (Simple SVG) -->
	<div class="mt-8 border-t border-slate-800 pt-6 flex justify-center">
		<svg width="200" height="120" viewBox="0 0 200 120" fill="none" xmlns="http://www.w3.org/2000/svg">
			{#if size === 'A5'}
				<!-- A4 to A5 Fold -->
				<rect x="20" y="20" width="160" height="80" rx="2" stroke="#475569" stroke-width="2" stroke-dasharray="4 4" />
				<line x1="100" y1="20" x2="100" y2="100" stroke="#f472b6" stroke-width="2" stroke-dasharray="4 4" />
				<path d="M110 40 L120 30 L110 20" stroke="#f472b6" stroke-width="2" fill="none" />
			{:else}
				<!-- A4 to A6 cut/fold -->
				<rect x="20" y="20" width="160" height="80" rx="2" stroke="#475569" stroke-width="2" />
				<line x1="20" y1="60" x2="180" y2="60" stroke="#64748b" stroke-width="2" /> <!-- Cut line -->
				<line x1="100" y1="20" x2="100" y2="60" stroke="#f472b6" stroke-width="1" stroke-dasharray="2 2" />
				<line x1="100" y1="60" x2="100" y2="100" stroke="#f472b6" stroke-width="1" stroke-dasharray="2 2" />
			{/if}
		</svg>
	</div>
</div>
