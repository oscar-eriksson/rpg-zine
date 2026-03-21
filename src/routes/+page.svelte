<script lang="ts">
	import { onMount, untrack } from 'svelte';
	import { SvelteSet } from 'svelte/reactivity';
	import { impose, type ImpositionOptions } from '$lib/imposition';
	import { bwAlgorithms, colorAlgorithms } from '$lib/filterAlgorithms';
	import { loadPrefs, savePrefs } from '$lib/prefs';
	import AssemblyGuide from '$lib/components/AssemblyGuide.svelte';
	import FoldedPreview from '$lib/components/FoldedPreview.svelte';
	import SheetPreview from '$lib/components/SheetPreview.svelte';
	import FilterControls from '$lib/components/FilterControls.svelte';
	import InspectModal from '$lib/components/InspectModal.svelte';

	let pdfData = $state<ArrayBuffer | null>(null);
	let pdfName = $state<string>('');
	let isProcessing = $state(false);
	let impositionError = $state<string | null>(null);
	let generatedPdfUrl = $state<string | null>(null);
	let imposedPdfData = $state<Uint8Array | null>(null);
	let view = $state<'print' | 'folded'>('print');

	let filterMode = $state<'none' | 'color' | 'bw'>('none');
	let bwAlgorithm = $state('lighten');
	let colorAlgorithm = $state('bleach-warm');
	let filterStrength = $state(0);
	let prefsReady = $state(false);

	let currentAlgos = $derived(filterMode === 'bw' ? bwAlgorithms : colorAlgorithms);
	let currentAlgoKey = $derived(filterMode === 'bw' ? bwAlgorithm : colorAlgorithm);
	let currentAlgo = $derived(currentAlgos.find((a) => a.key === currentAlgoKey) ?? currentAlgos[0]);
	let previewFilter = $derived(
		filterMode !== 'none' ? currentAlgo.filter(filterStrength / 100) : ''
	);

	let options = $state<ImpositionOptions>({
		size: 'A5',
		printerMargin: 5,
		middleMargin: 10,
		duplex: true,
		backToBack: false
	});

	let exportFileName = $derived(
		(pdfName.replace(/\.pdf$/i, '') || 'zine') +
			'_zine_' +
			options.size.toLowerCase() +
			(filterMode !== 'none' ? `_${filterMode}_${filterStrength}` : '') +
			'.pdf'
	);

	let previewAspect = $derived(options.size === 'A5' ? 'aspect-[1.414/1]' : 'aspect-[1/1.414]');

	let numImposedPages = $state(0);
	let isExporting = $state(false);
	let exportCurrent = $state(0);
	let exportTotal = $state(0);
	let exportDpi = $state(216); // 144=draft, 216=standard, 288=high

	async function downloadPdf() {
		if (!imposedPdfData || !generatedPdfUrl) return;
		if (filterMode === 'none') {
			const link = document.createElement('a');
			link.href = generatedPdfUrl;
			link.download = exportFileName;
			link.click();
			return;
		}
		isExporting = true;
		exportCurrent = 0;
		try {
			const { loadDocument } = await import('$lib/pdf');
			const { PDFDocument } = await import('pdf-lib');
			const doc = await loadDocument(imposedPdfData);
			exportTotal = doc.numPages;
			const outDoc = await PDFDocument.create();
			const scale = exportDpi / 72;
			for (let i = 1; i <= doc.numPages; i++) {
				exportCurrent = i;
				const page = await doc.getPage(i);
				const viewport = page.getViewport({ scale });
				const srcCanvas = document.createElement('canvas');
				srcCanvas.width = Math.round(viewport.width);
				srcCanvas.height = Math.round(viewport.height);
				const srcCtx = srcCanvas.getContext('2d')!;
				await page.render({ canvasContext: srcCtx, viewport, canvas: srcCanvas }).promise;
				const dstCanvas = document.createElement('canvas');
				dstCanvas.width = srcCanvas.width;
				dstCanvas.height = srcCanvas.height;
				const dstCtx = dstCanvas.getContext('2d')!;
				dstCtx.filter = previewFilter;
				dstCtx.drawImage(srcCanvas, 0, 0);
				const blob = await new Promise<Blob>((resolve, reject) =>
					dstCanvas.toBlob(
						(b) => (b ? resolve(b) : reject(new Error('toBlob failed'))),
						'image/jpeg',
						0.92
					)
				);
				const img = await outDoc.embedJpg(await blob.arrayBuffer());
				const outPage = outDoc.addPage([srcCanvas.width, srcCanvas.height]);
				outPage.drawImage(img, { x: 0, y: 0, width: srcCanvas.width, height: srcCanvas.height });
			}
			const bytes = new Uint8Array(await outDoc.save());
			const url = URL.createObjectURL(new Blob([bytes], { type: 'application/pdf' }));
			const link = document.createElement('a');
			link.href = url;
			link.download = exportFileName;
			link.click();
			setTimeout(() => URL.revokeObjectURL(url), 5000);
		} catch (e) {
			console.error('Filter export failed:', e);
		} finally {
			isExporting = false;
			exportCurrent = 0;
			exportTotal = 0;
		}
	}

	let visiblePages = new SvelteSet<number>();
	let inspectPage = $state<number | null>(null);

	function lazyPage(node: HTMLElement, index: number) {
		const observer = new IntersectionObserver(
			(entries) => {
				for (const entry of entries) {
					if (entry.isIntersecting) {
						visiblePages.add(index);
					} else {
						visiblePages.delete(index);
					}
				}
			},
			{ rootMargin: '800px 0px', threshold: 0 }
		);
		observer.observe(node);
		return {
			destroy() {
				observer.disconnect();
			}
		};
	}

	async function handleFileUpload(event: Event) {
		const input = event.target as HTMLInputElement;
		if (!input.files?.length) return;
		const file = input.files[0];
		pdfName = file.name;
		pdfData = await file.arrayBuffer();
		await generatePreview();
	}

	async function generatePreview() {
		if (!pdfData) return;
		isProcessing = true;
		impositionError = null;
		imposedPdfData = null;
		visiblePages.clear();
		if (generatedPdfUrl) {
			URL.revokeObjectURL(generatedPdfUrl);
			generatedPdfUrl = null;
		}
		try {
			const result = await impose(pdfData.slice(0), options);
			const blob = new Blob([result.buffer as ArrayBuffer], { type: 'application/pdf' });
			generatedPdfUrl = URL.createObjectURL(blob);
			imposedPdfData = result;
			const { PDFDocument } = await import('pdf-lib');
			const imposedDoc = await PDFDocument.load((result.buffer as ArrayBuffer).slice(0));
			numImposedPages = imposedDoc.getPageCount();
		} catch (error) {
			const msg = error instanceof Error ? error.message : String(error);
			console.error('Imposition failed:', msg);
			impositionError = msg;
		} finally {
			isProcessing = false;
		}
	}

	// Re-generate preview when options change. Destructuring forces Svelte to
	// track each property individually. untrack() prevents state writes inside
	// generatePreview() from becoming additional dependencies.
	$effect(() => {
		const { size, printerMargin, middleMargin } = options;
		if (pdfData && size && printerMargin >= 0 && middleMargin >= 0) {
			untrack(() => generatePreview());
		}
	});

	// Save margins keyed by size; save filter prefs flat — only after initial load
	$effect(() => {
		const { size, printerMargin, middleMargin } = options;
		if (prefsReady) savePrefs({ [size]: { printerMargin, middleMargin } });
	});
	$effect(() => {
		const mode = filterMode,
			bwAlgo = bwAlgorithm,
			colorAlgo = colorAlgorithm,
			strength = filterStrength;
		if (prefsReady)
			savePrefs({
				filterMode: mode,
				bwAlgorithm: bwAlgo,
				colorAlgorithm: colorAlgo,
				filterStrength: strength
			});
	});

	onMount(() => {
		const prefs = loadPrefs();
		const size = options.size;
		const sp = prefs[size];
		if (sp) {
			options.printerMargin = sp.printerMargin;
			options.middleMargin = sp.middleMargin;
		}
		if (prefs.filterMode) filterMode = prefs.filterMode;
		if (prefs.bwAlgorithm) bwAlgorithm = prefs.bwAlgorithm;
		if (prefs.colorAlgorithm) colorAlgorithm = prefs.colorAlgorithm;
		if (prefs.filterStrength !== undefined) filterStrength = prefs.filterStrength;
		prefsReady = true;
		return () => {
			if (generatedPdfUrl) URL.revokeObjectURL(generatedPdfUrl);
		};
	});
</script>

<main class="mx-auto grid max-w-7xl gap-12 p-4 lg:grid-cols-12 lg:p-12">
	<!-- Sidebar Controls -->
	<aside class="flex flex-col gap-8 lg:col-span-4">
		<div class="rounded-3xl border border-slate-800 bg-slate-900/50 p-8 backdrop-blur-sm">
			<h2 class="mb-8 flex items-center gap-2 text-lg font-bold">
				<span class="h-6 w-1.5 rounded-full bg-purple-500"></span>
				Settings
			</h2>

			<!-- File Upload -->
			<div class="group mb-10">
				<label
					for="pdf-upload"
					class="mb-4 block text-xs font-bold tracking-widest text-slate-500 uppercase transition-colors group-hover:text-slate-400"
					>Source PDF</label
				>
				<div class="relative">
					<input
						type="file"
						accept=".pdf"
						onchange={handleFileUpload}
						class="absolute inset-0 z-10 h-full w-full cursor-pointer opacity-0"
						id="pdf-upload"
					/>
					<div
						class="flex flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-slate-700 p-8 transition-all group-hover:border-purple-500/50 group-hover:bg-purple-500/5"
					>
						{#if pdfName}
							<div
								class="flex h-12 w-12 items-center justify-center rounded-xl bg-purple-500/10 text-purple-400"
							>
								<svg
									xmlns="http://www.w3.org/2000/svg"
									width="24"
									height="24"
									viewBox="0 0 24 24"
									fill="none"
									stroke="currentColor"
									stroke-width="2"
									stroke-linecap="round"
									stroke-linejoin="round"
									><path
										d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"
									/><polyline points="14 2 14 8 20 8" /></svg
								>
							</div>
							<p class="line-clamp-1 px-4 text-center text-sm font-bold text-slate-200">
								{pdfName}
							</p>
							<p class="font-mono text-[10px] text-slate-500">
								{(pdfData?.byteLength || 0) / 1024 / 1024 > 1
									? ((pdfData?.byteLength || 0) / 1024 / 1024).toFixed(2) + ' MB'
									: ((pdfData?.byteLength || 0) / 1024).toFixed(0) + ' KB'}
							</p>
						{:else}
							<div
								class="flex h-12 w-12 items-center justify-center rounded-xl bg-slate-800 text-slate-600"
							>
								<svg
									xmlns="http://www.w3.org/2000/svg"
									width="24"
									height="24"
									viewBox="0 0 24 24"
									fill="none"
									stroke="currentColor"
									stroke-width="2"
									stroke-linecap="round"
									stroke-linejoin="round"
									><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline
										points="17 8 12 3 7 8"
									/><line x1="12" y1="3" x2="12" y2="15" /></svg
								>
							</div>
							<p class="text-xs font-bold text-slate-500">Drop PDF or Click to Upload</p>
						{/if}
					</div>
				</div>
			</div>

			<!-- Zine Size Selection -->
			<div class="mb-10">
				<span class="mb-4 block text-xs font-bold tracking-widest text-slate-500 uppercase"
					>Zine Size</span
				>
				<div class="grid grid-cols-2 gap-4">
					{#each ['A5', 'A6'] as size (size)}
						<button
							onclick={() => {
								const s = size as 'A5' | 'A6';
								options.size = s;
								const sp = loadPrefs()[s];
								if (sp) {
									options.printerMargin = sp.printerMargin;
									options.middleMargin = sp.middleMargin;
								}
							}}
							class="group relative overflow-hidden rounded-2xl border-2 px-6 py-4 font-black transition-all {options.size ===
							size
								? 'border-purple-500 bg-purple-500/10 text-white shadow-lg shadow-purple-500/10'
								: 'border-slate-800 text-slate-600 hover:border-slate-700 hover:text-slate-400'}"
						>
							<span class="relative z-10">{size}</span>
							{#if options.size === size}
								<div
									class="absolute inset-0 bg-linear-to-br from-purple-500/5 to-transparent"
								></div>
							{/if}
						</button>
					{/each}
				</div>
			</div>

			<!-- Margin Controls -->
			<div class="mb-10 space-y-8">
				<div class="group">
					<div class="mb-4 flex items-center justify-between">
						<label
							for="printer-margin"
							class="text-xs font-bold tracking-widest text-slate-500 uppercase transition-colors group-hover:text-slate-400"
							>Printer Margin</label
						>
						<span class="rounded bg-purple-500/5 px-2 py-0.5 font-mono text-[10px] text-purple-500"
							>{options.printerMargin}mm</span
						>
					</div>
					<input
						id="printer-margin"
						type="range"
						bind:value={options.printerMargin}
						min="0"
						max="20"
						class="h-1.5 w-full cursor-pointer appearance-none rounded-lg bg-slate-800 accent-purple-500"
					/>
				</div>
				<div class="group">
					<div class="mb-4 flex items-center justify-between">
						<label
							for="gutter-margin"
							class="text-xs font-bold tracking-widest text-slate-500 uppercase transition-colors group-hover:text-slate-400"
							>Gutter (Middle)</label
						>
						<span class="rounded bg-purple-500/5 px-2 py-0.5 font-mono text-[10px] text-purple-500"
							>{options.middleMargin}mm</span
						>
					</div>
					<input
						id="gutter-margin"
						type="range"
						bind:value={options.middleMargin}
						min="0"
						max="40"
						class="h-1.5 w-full cursor-pointer appearance-none rounded-lg bg-slate-800 accent-purple-500"
					/>
				</div>
			</div>

			<FilterControls
				bind:filterMode
				bind:bwAlgorithm
				bind:colorAlgorithm
				bind:filterStrength
				bind:exportDpi
			/>

			<!-- View Switcher -->
			<div class="mb-8 flex rounded-xl border border-slate-700/50 bg-slate-900 p-1">
				<button
					onclick={() => (view = 'print')}
					class="flex-1 rounded-lg py-2 text-xs font-bold transition-all {view === 'print'
						? 'bg-slate-800 text-white shadow-lg'
						: 'text-slate-500 hover:text-slate-400'}"
				>
					PRINT SHEETS
				</button>
				<button
					onclick={() => (view = 'folded')}
					class="flex-1 rounded-lg py-2 text-xs font-bold transition-all {view === 'folded'
						? 'bg-slate-800 text-white shadow-lg'
						: 'text-slate-500 hover:text-slate-400'}"
				>
					FOLDED PREVIEW
				</button>
			</div>

			<div class="mb-8">
				<AssemblyGuide size={options.size} duplex={true} />
			</div>

			<!-- Assembly Info -->
			<div
				class="rounded-xl border border-slate-700/50 bg-slate-900/50 p-4 text-xs leading-relaxed text-slate-500"
			>
				<p class="mb-1 flex items-center gap-1 font-bold text-slate-400">
					<svg
						xmlns="http://www.w3.org/2000/svg"
						width="14"
						height="14"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						stroke-width="2"
						stroke-linecap="round"
						stroke-linejoin="round"
						><circle cx="12" cy="12" r="10" /><line x1="12" y1="16" x2="12" y2="12" /><line
							x1="12"
							y1="8"
							x2="12.01"
							y2="8"
						/></svg
					>
					Assembly Info
				</p>
				{#if options.size === 'A5'}
					Print double-sided (flip on long edge). Fold in half and staple in the middle.
				{:else}
					Print double-sided (flip on long edge). Cut A4 sheets in half horizontally. Stack and
					fold.
				{/if}
			</div>
		</div>

		<!-- Export progress bar -->
		{#if isExporting}
			<div class="space-y-2 rounded-2xl border border-slate-800 bg-slate-900/50 p-4">
				<div class="flex justify-between font-mono text-[10px] text-slate-500">
					<span class="tracking-widest uppercase">Rendering page</span>
					<span class="text-purple-400">{exportCurrent} / {exportTotal}</span>
				</div>
				<div class="h-1.5 overflow-hidden rounded-full bg-slate-800">
					<div
						class="h-full rounded-full bg-purple-500 transition-all duration-300"
						style="width: {exportTotal ? (exportCurrent / exportTotal) * 100 : 0}%"
					></div>
				</div>
			</div>
		{/if}

		<!-- Download button -->
		<button
			onclick={downloadPdf}
			disabled={!generatedPdfUrl || isProcessing || isExporting}
			class="block w-full rounded-2xl bg-linear-to-r from-purple-600 to-pink-600 py-4 text-center font-black text-white shadow-lg shadow-purple-500/20 transition-all hover:from-purple-500 hover:to-pink-500 disabled:cursor-not-allowed disabled:from-slate-800 disabled:to-slate-800 disabled:text-slate-600"
		>
			{isProcessing ? 'GENERATING...' : isExporting ? 'EXPORTING...' : 'DOWNLOAD PDF'}
		</button>
	</aside>

	<!-- Live Preview Area -->
	<section class="flex flex-col gap-6 lg:col-span-8">
		<div class="flex items-center justify-between font-mono">
			<h2 class="flex items-center gap-2 text-xl font-bold">
				<span class="h-6 w-1.5 rounded-full bg-pink-500"></span>
				Print Preview
			</h2>
			<div class="flex items-center gap-4 text-[10px] tracking-widest text-slate-500 uppercase">
				<span class="flex items-center gap-1">
					<div class="h-0.5 w-3 border-t border-dashed border-pink-500/50"></div>
					Fold Line
				</span>
				<span class="flex items-center gap-1">
					<div class="h-0.5 w-3 bg-slate-700"></div>
					Cut Line
				</span>
			</div>
		</div>

		<div
			class="relative flex h-[800px] items-center justify-center overflow-hidden rounded-3xl border border-slate-800 bg-slate-900 p-8"
		>
			{#if isProcessing}
				<div class="flex animate-pulse flex-col items-center gap-4">
					<div
						class="h-12 w-12 animate-spin rounded-full border-4 border-purple-500/20 border-t-purple-500"
					></div>
					<p class="text-xs font-bold tracking-widest text-slate-500 uppercase">
						Generating Sheets...
					</p>
				</div>
			{:else if impositionError}
				<div class="flex max-w-sm flex-col items-center gap-3 text-center">
					<div
						class="flex h-12 w-12 items-center justify-center rounded-xl bg-red-500/10 text-red-400"
					>
						<svg
							xmlns="http://www.w3.org/2000/svg"
							width="24"
							height="24"
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							stroke-width="2"
							><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line
								x1="12"
								y1="16"
								x2="12.01"
								y2="16"
							/></svg
						>
					</div>
					<p class="text-xs font-bold tracking-widest text-red-400 uppercase">Imposition Error</p>
					<p class="font-mono text-xs text-slate-500">{impositionError}</p>
				</div>
			{:else if pdfData}
				<div class="flex h-full w-full flex-col items-center gap-8 p-4">
					{#if view === 'print'}
						{#if generatedPdfUrl}
							<div
								class="custom-scrollbar flex h-full w-full flex-col items-center space-y-12 overflow-y-auto pr-2"
							>
								{#each Array.from({ length: numImposedPages }, (_, i) => i) as i (i)}
									{@const sheetNum = Math.floor(i / 2) + 1}
									{@const isFront = i % 2 === 0}

									<div class="w-full max-w-[550px] space-y-3" use:lazyPage={i}>
										{#if isFront}
											<div class="mb-2 flex items-center gap-4">
												<div class="h-px flex-1 bg-slate-800"></div>
												<span
													class="text-[10px] font-black tracking-widest text-slate-500 uppercase"
													>Sheet {sheetNum}</span
												>
												<div class="h-px flex-1 bg-slate-800"></div>
											</div>
										{/if}

										<div
											class="relative w-full shrink-0 cursor-zoom-in rounded-lg bg-white shadow-2xl transition-transform hover:scale-[1.01] {previewAspect} group/sheet overflow-hidden"
											style={previewFilter ? `filter: ${previewFilter}` : undefined}
											onclick={() => (inspectPage = i + 1)}
											role="button"
											tabindex="0"
											onkeydown={(e) => e.key === 'Enter' && (inspectPage = i + 1)}
										>
											{#if visiblePages.has(i)}
												<SheetPreview pdfBuffer={imposedPdfData} pageNumber={i + 1} />
											{:else}
												<div class="h-full w-full animate-pulse bg-slate-100"></div>
											{/if}

											<!-- Overlays (Fold lines etc) -->
											<div
												class="pointer-events-none absolute inset-0 border-2 border-slate-700/10"
											>
												{#if options.size === 'A5'}
													<div
														class="absolute top-0 bottom-0 left-1/2 border-l border-dashed border-pink-500/40"
													></div>
												{:else}
													<!-- A6: Cross layout (Horizontal Cut, Vertical Fold) -->
													<div class="absolute inset-0 flex flex-col">
														<div class="flex flex-1 border-b border-slate-400/60">
															<div class="flex-1 border-r border-dashed border-pink-500/30"></div>
															<div class="flex-1"></div>
														</div>
														<div class="flex flex-1">
															<div class="flex-1 border-r border-dashed border-pink-500/30"></div>
															<div class="flex-1"></div>
														</div>
													</div>
												{/if}
											</div>

											<!-- Inspect hover hint -->
											<div
												class="pointer-events-none absolute bottom-3 left-3 opacity-0 transition-opacity group-hover/sheet:opacity-100"
											>
												<div
													class="flex items-center gap-1.5 rounded-full bg-black/60 px-2.5 py-1 text-[9px] font-bold text-white backdrop-blur-sm"
												>
													<svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/><line x1="11" y1="8" x2="11" y2="14"/><line x1="8" y1="11" x2="14" y2="11"/></svg>
													Inspect
												</div>
											</div>

											<!-- Smart Label -->
											<div class="absolute top-3 right-3 flex items-center gap-2">
												<div
													class="rounded-full border border-white/10 bg-slate-900/90 px-2.5 py-1 text-[9px] font-black tracking-tighter text-white uppercase shadow-xl backdrop-blur-md"
												>
													Sheet {sheetNum} <span class="mx-1 text-purple-400">•</span>
													{isFront ? 'Front' : 'Back'}
												</div>
											</div>
										</div>
									</div>
								{/each}

								<div class="space-y-2 py-12 text-center opacity-30">
									<div class="mx-auto h-1.5 w-1.5 rounded-full bg-slate-500"></div>
									<p class="text-[10px] font-bold tracking-widest text-slate-500 uppercase">
										End of Preview
									</p>
								</div>
							</div>
						{:else}
							<div class="flex flex-col items-center gap-4 opacity-40">
								<div
									class="h-12 w-12 animate-spin rounded-full border-4 border-slate-700/20 border-t-slate-500"
								></div>
								<p class="text-[10px] font-bold tracking-widest text-slate-500 uppercase">
									Preparing Print Preview...
								</p>
							</div>
						{/if}
					{:else}
						<div
							style={previewFilter
								? `filter: ${previewFilter}; width: 100%; height: 100%`
								: 'width: 100%; height: 100%'}
						>
							<FoldedPreview {pdfData} {options} />
						</div>
					{/if}
				</div>
			{:else}
				<div class="text-center opacity-40">
					<div
						class="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-3xl bg-slate-800"
					>
						<svg
							xmlns="http://www.w3.org/2000/svg"
							width="32"
							height="32"
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							stroke-width="2"
							stroke-linecap="round"
							stroke-linejoin="round"
							class="text-slate-600"
							><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline
								points="14 2 14 8 20 8"
							/><line x1="12" y1="18" x2="12" y2="12" /><polyline points="9 15 12 12 15 15" /></svg
						>
					</div>
					<p class="text-xs font-medium tracking-widest text-slate-500 uppercase">
						Awaiting PDF Upload
					</p>
				</div>
			{/if}
		</div>
	</section>
</main>

<InspectModal
	bind:page={inspectPage}
	numPages={numImposedPages}
	pdfBuffer={imposedPdfData}
	{previewFilter}
	{previewAspect}
/>

<style>
	:global(body) {
		background-color: #0f172a;
	}
	.custom-scrollbar::-webkit-scrollbar {
		width: 4px;
	}
	.custom-scrollbar::-webkit-scrollbar-track {
		background: transparent;
	}
	.custom-scrollbar::-webkit-scrollbar-thumb {
		background: #1e293b;
		border-radius: 10px;
	}
	.custom-scrollbar::-webkit-scrollbar-thumb:hover {
		background: #334155;
	}
</style>
