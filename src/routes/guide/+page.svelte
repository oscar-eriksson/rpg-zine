<script lang="ts">
	const sections = [
		{
			id: 'what-is-a-zine',
			title: 'What is a Zine?',
		},
		{
			id: 'preparing-your-pdf',
			title: 'Preparing Your PDF',
		},
		{
			id: 'page-counts',
			title: 'Page Counts & Imposition',
		},
		{
			id: 'printing',
			title: 'Printing Tips',
		},
		{
			id: 'assembly',
			title: 'Assembly',
		},
	];
</script>

<main class="max-w-7xl mx-auto px-4 lg:px-12 py-12 grid lg:grid-cols-12 gap-12">

	<!-- Sidebar TOC -->
	<aside class="lg:col-span-3">
		<div class="sticky top-28 bg-slate-900/50 border border-slate-800 rounded-3xl p-6">
			<p class="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-4">On this page</p>
			<nav class="flex flex-col gap-1">
				{#each sections as s}
					<a href="#{s.id}" class="text-xs text-slate-400 hover:text-white transition-colors py-1 border-l-2 border-transparent hover:border-purple-500 pl-3">{s.title}</a>
				{/each}
			</nav>
		</div>
	</aside>

	<!-- Main content -->
	<article class="lg:col-span-9 flex flex-col gap-16">

		<div>
			<h2 class="text-3xl font-black tracking-tight mb-3">
				<span class="w-1.5 h-8 bg-purple-500 rounded-full inline-block mr-3 align-middle"></span>
				Guide
			</h2>
			<p class="text-slate-400 text-sm">Everything you need to make a print-ready RPG zine from a PDF.</p>
		</div>

		<!-- What is a zine -->
		<section id="what-is-a-zine" class="scroll-mt-28">
			<h3 class="text-lg font-black mb-4 flex items-center gap-3">
				<span class="w-6 h-6 rounded-lg bg-purple-500/20 text-purple-400 flex items-center justify-center text-[10px] font-black">1</span>
				What is a Zine?
			</h3>
			<div class="bg-slate-900/50 border border-slate-800 rounded-2xl p-6 space-y-3 text-sm text-slate-400 leading-relaxed">
				<p>A <strong class="text-slate-200">zine</strong> (short for magazine or fanzine) is a small self-published booklet. In the TTRPG world zines are the format of choice for one-shots, mini-supplements, player handouts, and indie rulesets — they're cheap to print, easy to assemble, and feel tactile at the table.</p>
				<p>This tool does <strong class="text-slate-200">imposition</strong> — it takes your PDF (where each page is one zine page) and rearranges them onto A4 print sheets so that when you fold and staple you get a proper booklet in reading order.</p>
			</div>
		</section>

		<!-- Preparing your PDF -->
		<section id="preparing-your-pdf" class="scroll-mt-28">
			<h3 class="text-lg font-black mb-4 flex items-center gap-3">
				<span class="w-6 h-6 rounded-lg bg-purple-500/20 text-purple-400 flex items-center justify-center text-[10px] font-black">2</span>
				Preparing Your PDF
			</h3>
			<div class="bg-slate-900/50 border border-slate-800 rounded-2xl divide-y divide-slate-800 text-sm">
				{#each [
					{
						q: 'What page size should my PDF be?',
						a: 'Each page in your source PDF should match your target zine size. A5 zine → A5 pages (148×210mm). A6 zine → A6 pages (105×148mm). The generator scales pages to fit, but matching the size avoids cropping.',
					},
					{
						q: 'What order should the pages be in?',
						a: 'Normal reading order — page 1, 2, 3 … The imposition engine handles the reordering automatically. Don\'t try to pre-arrange pages yourself.',
					},
					{
						q: 'Can I use any PDF?',
						a: 'Yes — exported from InDesign, Affinity, Canva, Google Slides, or even scanned pages. Vector PDFs print the sharpest. Embedded images work fine as long as they\'re at least 300 dpi at the final print size.',
					},
					{
						q: 'What about bleeds?',
						a: 'Add a 3mm bleed to each edge of your pages in your layout app if you want edge-to-edge printing. Most home printers can\'t print to the edge anyway, so a 5mm printer margin in the generator is a safe default.',
					},
				] as item}
					<div class="p-5 space-y-1">
						<p class="font-bold text-slate-200 text-xs uppercase tracking-wide">{item.q}</p>
						<p class="text-slate-400 leading-relaxed">{item.a}</p>
					</div>
				{/each}
			</div>
		</section>

		<!-- Page counts -->
		<section id="page-counts" class="scroll-mt-28">
			<h3 class="text-lg font-black mb-4 flex items-center gap-3">
				<span class="w-6 h-6 rounded-lg bg-purple-500/20 text-purple-400 flex items-center justify-center text-[10px] font-black">3</span>
				Page Counts &amp; Imposition
			</h3>
			<div class="grid sm:grid-cols-2 gap-4 mb-4">
				<div class="bg-slate-900/50 border border-purple-500/20 rounded-2xl p-5">
					<p class="text-xs font-black text-purple-400 uppercase tracking-widest mb-3">A5 Format</p>
					<ul class="text-xs text-slate-400 space-y-2 leading-relaxed">
						<li class="flex gap-2"><span class="text-purple-500 mt-0.5">→</span>2 A5 pages per A4 side, so 4 pages per sheet</li>
						<li class="flex gap-2"><span class="text-purple-500 mt-0.5">→</span>Page count must be a <strong class="text-slate-200">multiple of 4</strong></li>
						<li class="flex gap-2"><span class="text-purple-500 mt-0.5">→</span>Common counts: 4, 8, 12, 16, 20, 24pp</li>
						<li class="flex gap-2"><span class="text-purple-500 mt-0.5">→</span>A4 sheet folds once along the long axis</li>
					</ul>
				</div>
				<div class="bg-slate-900/50 border border-pink-500/20 rounded-2xl p-5">
					<p class="text-xs font-black text-pink-400 uppercase tracking-widest mb-3">A6 Format</p>
					<ul class="text-xs text-slate-400 space-y-2 leading-relaxed">
						<li class="flex gap-2"><span class="text-pink-500 mt-0.5">→</span>4 A6 pages per A4 side, so 8 pages per sheet</li>
						<li class="flex gap-2"><span class="text-pink-500 mt-0.5">→</span>Page count must be a <strong class="text-slate-200">multiple of 8</strong></li>
						<li class="flex gap-2"><span class="text-pink-500 mt-0.5">→</span>Common counts: 8, 16, 24, 32pp</li>
						<li class="flex gap-2"><span class="text-pink-500 mt-0.5">→</span>A4 sheet is cut horizontally, each half folds to A6</li>
					</ul>
				</div>
			</div>
			<div class="bg-slate-900/50 border border-slate-800 rounded-2xl p-5 text-xs text-slate-500 leading-relaxed">
				<strong class="text-slate-300">Tip:</strong> If your page count isn't a multiple of the required number, add blank pages at the end. Most layout apps can insert blank pages automatically. The generator will pad with blank pages if needed, but explicit blanks give you more control over where they fall.
			</div>
		</section>

		<!-- Printing -->
		<section id="printing" class="scroll-mt-28">
			<h3 class="text-lg font-black mb-4 flex items-center gap-3">
				<span class="w-6 h-6 rounded-lg bg-purple-500/20 text-purple-400 flex items-center justify-center text-[10px] font-black">4</span>
				Printing Tips
			</h3>
			<div class="bg-slate-900/50 border border-slate-800 rounded-2xl divide-y divide-slate-800 text-sm">
				{#each [
					{
						label: 'Duplex (Double-Sided)',
						body: 'Enable duplex printing in both the generator and your printer dialog. Set flip direction to Long Edge for A5 and A6 — this ensures front and back of each sheet align correctly.',
					},
					{
						label: 'Paper Weight',
						body: '80gsm copier paper works fine. For a premium feel try 90–100gsm. Anything above 120gsm may not fold cleanly without scoring first.',
					},
					{
						label: 'Fit to Page',
						body: 'In your PDF viewer, choose "Actual Size" (not "Fit to Page" or "Shrink to Fit"). Scaling will shift your fold lines and ruin the imposition.',
					},
					{
						label: 'Test Print',
						body: 'Print a single sheet first, fold it, and check that pages land in the right order before committing to a full print run.',
					},
				] as item}
					<div class="p-5 space-y-1">
						<p class="font-bold text-slate-200 text-xs uppercase tracking-wide">{item.label}</p>
						<p class="text-slate-400 leading-relaxed">{item.body}</p>
					</div>
				{/each}
			</div>
		</section>

		<!-- Assembly -->
		<section id="assembly" class="scroll-mt-28">
			<h3 class="text-lg font-black mb-4 flex items-center gap-3">
				<span class="w-6 h-6 rounded-lg bg-purple-500/20 text-purple-400 flex items-center justify-center text-[10px] font-black">5</span>
				Assembly
			</h3>
			<div class="grid sm:grid-cols-2 gap-4">
				{#each [
					{ step: '01', title: 'Stack', body: 'Place all sheets in order — sheet 1 on the outside, last sheet in the centre.' },
					{ step: '02', title: 'Fold', body: 'For A5: fold the stack in half along the spine. For A6: cut each sheet horizontally first, then fold each half-stack.' },
					{ step: '03', title: 'Staple (Saddle Stitch)', body: 'Open the booklet to the centre spread. Place two staples along the spine — one third from each end. Close and flatten.' },
					{ step: '04', title: 'Trim (optional)', body: 'For a crisp edge, trim the open side with a guillotine or craft knife and ruler. Adds a professional finish.' },
				] as item}
					<div class="bg-slate-900/50 border border-slate-800 rounded-2xl p-5 flex gap-4">
						<span class="text-2xl font-black text-slate-800 font-mono leading-none mt-0.5 shrink-0">{item.step}</span>
						<div>
							<p class="text-xs font-black text-white mb-1 uppercase tracking-wide">{item.title}</p>
							<p class="text-xs text-slate-400 leading-relaxed">{item.body}</p>
						</div>
					</div>
				{/each}
			</div>

			<div class="mt-4 bg-slate-900/50 border border-slate-800 rounded-2xl p-5 text-xs text-slate-500 leading-relaxed">
				<strong class="text-slate-300">Long-arm stapler:</strong> Standard staplers only reach ~4cm from the edge. For thicker booklets or centre-stapling wider paper you'll need a long-arm stapler (sometimes called a booklet stapler). Alternatively, use an awl to punch holes and bind with thread for a hand-stitched look.
			</div>
		</section>

	</article>
</main>
