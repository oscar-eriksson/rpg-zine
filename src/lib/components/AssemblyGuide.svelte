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

	<!-- Visual Guide -->
	<div class="mt-6 border-t border-slate-800 pt-6 flex justify-center">
		{#if size === 'A5'}
			<!-- A5: A4 landscape → fold → A5 portrait booklet -->
			<svg viewBox="0 0 230 105" fill="none" xmlns="http://www.w3.org/2000/svg" class="w-full max-w-[260px]">
				<defs>
					<marker id="arr" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
						<path d="M1 1 L5 3 L1 5" stroke="#475569" stroke-width="1" fill="none"/>
					</marker>
				</defs>

				<!-- A4 landscape sheet -->
				<!-- Left page area -->
				<rect x="8" y="10" width="54" height="76" fill="#1e293b" rx="1"/>
				<!-- Right page area -->
				<rect x="62" y="10" width="54" height="76" fill="#172033" rx="1"/>
				<!-- Sheet outline -->
				<rect x="8" y="10" width="108" height="76" stroke="#475569" stroke-width="1.5" rx="1"/>

				<!-- Left page content lines -->
				<rect x="15" y="19" width="32" height="4" fill="#334155" rx="1"/>
				<rect x="15" y="27" width="40" height="2" fill="#273344" rx="1"/>
				<rect x="15" y="32" width="36" height="2" fill="#273344" rx="1"/>
				<rect x="15" y="37" width="40" height="2" fill="#273344" rx="1"/>
				<rect x="15" y="42" width="28" height="2" fill="#273344" rx="1"/>
				<rect x="15" y="54" width="40" height="2" fill="#273344" rx="1"/>
				<rect x="15" y="59" width="32" height="2" fill="#273344" rx="1"/>

				<!-- Right page content lines -->
				<rect x="69" y="19" width="32" height="4" fill="#334155" rx="1"/>
				<rect x="69" y="27" width="40" height="2" fill="#273344" rx="1"/>
				<rect x="69" y="32" width="36" height="2" fill="#273344" rx="1"/>
				<rect x="69" y="37" width="40" height="2" fill="#273344" rx="1"/>
				<rect x="69" y="42" width="28" height="2" fill="#273344" rx="1"/>
				<rect x="69" y="54" width="40" height="2" fill="#273344" rx="1"/>
				<rect x="69" y="59" width="32" height="2" fill="#273344" rx="1"/>

				<!-- Center fold line (pink dashed) -->
				<line x1="62" y1="10" x2="62" y2="86" stroke="#f472b6" stroke-width="1.5" stroke-dasharray="4 3"/>

				<!-- Fold arrow: right half curls over left -->
				<path d="M84 34 Q84 22 62 22" stroke="#f472b6" stroke-width="1.5" stroke-linecap="round" marker-end="url(#foldArr)"/>
				<defs>
					<marker id="foldArr" markerWidth="6" markerHeight="6" refX="1" refY="3" orient="auto">
						<path d="M5 1 L1 3 L5 5" stroke="#f472b6" stroke-width="1.2" fill="none" stroke-linecap="round"/>
					</marker>
				</defs>

				<!-- FOLD label -->
				<text x="62" y="97" text-anchor="middle" font-size="7" fill="#f472b6" font-family="monospace" font-weight="bold" letter-spacing="1">FOLD</text>
				<!-- A4 label -->
				<text x="62" y="8" text-anchor="middle" font-size="7" fill="#64748b" font-family="monospace">A4 sheet</text>

				<!-- Arrow → -->
				<line x1="124" y1="48" x2="144" y2="48" stroke="#475569" stroke-width="1.5" marker-end="url(#arr)"/>

				<!-- A5 portrait booklet result -->
				<!-- Shadow/depth -->
				<rect x="155" y="14" width="54" height="76" fill="#0f172a" rx="2"/>
				<!-- Back page -->
				<rect x="153" y="12" width="54" height="76" fill="#1a2538" rx="2" stroke="#374151" stroke-width="1"/>
				<!-- Front page -->
				<rect x="150" y="10" width="54" height="76" fill="#1e293b" rx="2" stroke="#475569" stroke-width="1.5"/>
				<!-- Spine highlight -->
				<rect x="150" y="10" width="4" height="76" fill="#7c3aed" rx="1" opacity="0.8"/>

				<!-- Front cover content -->
				<rect x="161" y="20" width="28" height="5" fill="#334155" rx="1"/>
				<rect x="161" y="29" width="36" height="2" fill="#273344" rx="1"/>
				<rect x="161" y="34" width="30" height="2" fill="#273344" rx="1"/>

				<!-- Staple marks on spine -->
				<rect x="151" y="33" width="3" height="1.5" fill="#94a3b8" rx="0.5"/>
				<rect x="151" y="62" width="3" height="1.5" fill="#94a3b8" rx="0.5"/>

				<!-- ZINE label -->
				<text x="177" y="97" text-anchor="middle" font-size="7" fill="#64748b" font-family="monospace">A5 zine</text>
			</svg>

		{:else}
			<!-- A6: A4 portrait → cut horizontally → fold each half → two A6 zines -->
			<!-- A4 portrait ratio: 210:297 ≈ 0.707:1. At width=76 → height=107 -->
			<svg viewBox="0 0 230 125" fill="none" xmlns="http://www.w3.org/2000/svg" class="w-full max-w-[260px]">
				<defs>
					<marker id="arr6" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
						<path d="M1 1 L5 3 L1 5" stroke="#475569" stroke-width="1" fill="none"/>
					</marker>
					<marker id="foldArr6" markerWidth="6" markerHeight="6" refX="1" refY="3" orient="auto">
						<path d="M5 1 L1 3 L5 5" stroke="#f472b6" stroke-width="1.2" fill="none" stroke-linecap="round"/>
					</marker>
				</defs>

				<!-- A4 portrait sheet (76×107) with 4 A6 quadrants -->
				<!-- TL quadrant -->
				<rect x="8" y="9" width="38" height="53" fill="#1e293b" rx="1"/>
				<!-- TR quadrant -->
				<rect x="46" y="9" width="38" height="53" fill="#172033" rx="1"/>
				<!-- BL quadrant -->
				<rect x="8" y="62" width="38" height="54" fill="#172033" rx="1"/>
				<!-- BR quadrant -->
				<rect x="46" y="62" width="38" height="54" fill="#1e293b" rx="1"/>
				<!-- Sheet outline -->
				<rect x="8" y="9" width="76" height="107" stroke="#475569" stroke-width="1.5" rx="1"/>

				<!-- Content lines — top-left -->
				<rect x="13" y="16" width="18" height="3" fill="#334155" rx="1"/>
				<rect x="13" y="22" width="26" height="1.5" fill="#273344" rx="1"/>
				<rect x="13" y="26" width="20" height="1.5" fill="#273344" rx="1"/>
				<rect x="13" y="30" width="24" height="1.5" fill="#273344" rx="1"/>
				<rect x="13" y="38" width="26" height="1.5" fill="#273344" rx="1"/>
				<rect x="13" y="42" width="18" height="1.5" fill="#273344" rx="1"/>

				<!-- Content lines — top-right -->
				<rect x="51" y="16" width="18" height="3" fill="#334155" rx="1"/>
				<rect x="51" y="22" width="26" height="1.5" fill="#273344" rx="1"/>
				<rect x="51" y="26" width="20" height="1.5" fill="#273344" rx="1"/>
				<rect x="51" y="30" width="24" height="1.5" fill="#273344" rx="1"/>

				<!-- Content lines — bottom-left -->
				<rect x="13" y="68" width="18" height="3" fill="#334155" rx="1"/>
				<rect x="13" y="74" width="26" height="1.5" fill="#273344" rx="1"/>
				<rect x="13" y="78" width="20" height="1.5" fill="#273344" rx="1"/>
				<rect x="13" y="82" width="24" height="1.5" fill="#273344" rx="1"/>

				<!-- Content lines — bottom-right -->
				<rect x="51" y="68" width="18" height="3" fill="#334155" rx="1"/>
				<rect x="51" y="74" width="26" height="1.5" fill="#273344" rx="1"/>
				<rect x="51" y="78" width="20" height="1.5" fill="#273344" rx="1"/>

				<!-- Horizontal cut line -->
				<line x1="8" y1="62" x2="84" y2="62" stroke="#94a3b8" stroke-width="1.5"/>
				<text x="86" y="65" font-size="9" fill="#64748b">✂</text>

				<!-- Vertical fold line (runs full height, pink dashed) -->
				<line x1="46" y1="9" x2="46" y2="116" stroke="#f472b6" stroke-width="1.2" stroke-dasharray="3 2.5"/>

				<!-- Labels -->
				<text x="46" y="7" text-anchor="middle" font-size="7" fill="#64748b" font-family="monospace">A4 sheet</text>
				<text x="27" y="121" text-anchor="middle" font-size="6.5" fill="#94a3b8" font-family="monospace">cut</text>
				<text x="46" y="121" text-anchor="middle" font-size="6.5" fill="#f472b6" font-family="monospace" dx="12">fold</text>

				<!-- Arrow → -->
				<line x1="100" y1="62" x2="118" y2="62" stroke="#475569" stroke-width="1.5" marker-end="url(#arr6)"/>

				<!-- Two A6 portrait booklets, fanned slightly -->
				<!-- A6 portrait ratio: 105:148 ≈ 0.709:1. At width=38 → height=54 -->
				<!-- Back booklet -->
				<rect x="133" y="36" width="38" height="54" fill="#0f172a" rx="2"/>
				<!-- Second booklet offset -->
				<rect x="130" y="56" width="38" height="54" fill="#1a2538" rx="2" stroke="#374151" stroke-width="1"/>
				<rect x="130" y="56" width="3" height="54" fill="#6d28d9" rx="1" opacity="0.7"/>
				<rect x="137" y="64" width="16" height="3" fill="#273344" rx="1"/>
				<rect x="137" y="70" width="22" height="1.5" fill="#1e2d3d" rx="1"/>
				<!-- Top booklet -->
				<rect x="130" y="34" width="38" height="54" fill="#1e293b" rx="2" stroke="#475569" stroke-width="1.5"/>
				<rect x="130" y="34" width="3" height="54" fill="#7c3aed" rx="1" opacity="0.9"/>
				<!-- Cover content -->
				<rect x="138" y="43" width="16" height="3.5" fill="#334155" rx="1"/>
				<rect x="138" y="50" width="22" height="1.5" fill="#273344" rx="1"/>
				<rect x="138" y="54" width="18" height="1.5" fill="#273344" rx="1"/>
				<!-- Staples on spine -->
				<rect x="131" y="50" width="2.5" height="1.5" fill="#94a3b8" rx="0.5"/>
				<rect x="131" y="65" width="2.5" height="1.5" fill="#94a3b8" rx="0.5"/>

				<text x="149" y="118" text-anchor="middle" font-size="7" fill="#64748b" font-family="monospace">A6 zines</text>
			</svg>
		{/if}
	</div>
</div>
