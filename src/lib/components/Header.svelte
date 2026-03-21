<script lang="ts">
	import { page } from '$app/stores';
	import { resolve } from '$app/paths';
</script>

<header
	class="sticky top-0 z-50 flex items-center justify-between border-b border-slate-900 bg-slate-950/50 p-8 backdrop-blur-xl lg:px-12"
>
	<a href={resolve('/')} class="flex items-center gap-4">
		<div
			class="flex h-10 w-10 rotate-3 items-center justify-center rounded-xl bg-linear-to-br from-purple-600 to-pink-600 shadow-lg shadow-purple-500/20"
		>
			<svg
				xmlns="http://www.w3.org/2000/svg"
				width="24"
				height="24"
				viewBox="0 0 24 24"
				fill="none"
				stroke="white"
				stroke-width="3"
				stroke-linecap="round"
				stroke-linejoin="round"
				><path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1-2.5-2.5Z" /><path
					d="M8 7h6"
				/><path d="M8 11h8" /></svg
			>
		</div>
		<div>
			<h1
				class="bg-linear-to-r from-white to-slate-400 bg-clip-text text-2xl font-black tracking-tighter text-transparent uppercase italic"
			>
				ZINE GENERATOR
			</h1>
			<p class="text-[10px] font-bold tracking-widest text-slate-500 uppercase">
				Turn any PDF into a print-ready RPG zine.
			</p>
		</div>
	</a>
	<nav
		class="hidden items-center gap-8 text-xs font-bold tracking-widest text-slate-500 uppercase md:flex"
	>
		{#each [['/', 'Generator'], ['/guide', 'Guide']] as [href, label] (href)}
			<a
				href={resolve(href)}
				class="transition-colors {$page.url.pathname === href
					? 'text-white'
					: 'hover:text-slate-300'}">{label}</a
			>
		{/each}
		<span class="text-slate-800">|</span>
		<span class="text-slate-600">RPG Zine Utility</span>
	</nav>
</header>
