<script lang="ts">
	import './layout.css';
	import favicon from '$lib/assets/favicon.svg';
	import Header from '$lib/components/Header.svelte';

	let { children } = $props();
</script>

<svelte:head><link rel="icon" href={favicon} /></svelte:head>
<div class="min-h-screen bg-slate-950 text-slate-100 font-sans selection:bg-purple-500/30 selection:text-purple-200 flex flex-col">
	<Header />
	<div class="flex-1">
		{@render children()}
	</div>
	<footer class="border-t border-slate-900 px-8 lg:px-12 py-6 flex items-center justify-between gap-4 text-[11px] text-slate-600">
		<span>By <span class="text-slate-400 font-bold">Oscar Eriksson</span></span>
		<a
			href="https://ko-fi.com/oscareriksson2"
			target="_blank"
			rel="noopener noreferrer"
			class="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 hover:border-slate-700 hover:text-slate-300 transition-all text-slate-500 font-bold"
		>
			<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="currentColor" class="text-pink-500">
				<path d="M12 21.593c-5.63-5.539-11-10.297-11-14.402 0-3.791 3.068-5.191 5.281-5.191 1.312 0 4.151.501 5.719 4.457 1.59-3.968 4.464-4.447 5.726-4.447 2.54 0 5.274 1.621 5.274 5.181 0 4.069-5.136 8.625-11 14.402z"/>
			</svg>
			Support on Ko-fi
		</a>
	</footer>
</div>
