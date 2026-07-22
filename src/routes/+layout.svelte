<script lang="ts">
	import { page } from '$app/state';
	import favicon from '$lib/assets/favicon.svg';
	import '../app.css';

	let { data, children } = $props();
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
</svelte:head>

<header>
	<nav>
		<a href="/" class="brand">Gamedev Shop</a>
		<div class="links">
			<a href="/" class:active={page.url.pathname === '/'}>Shop</a>
			{#if data.user?.isAdmin}
				<a href="/admin" class:active={page.url.pathname === '/admin'}>Items</a>
				<a href="/admin/users" class:active={page.url.pathname === '/admin/users'}>Users</a>
				<a href="/admin/orders" class:active={page.url.pathname === '/admin/orders'}>Orders</a>
			{/if}
		</div>
		<div class="session">
			<span class="balance" title="Your balance">{data.user?.balance ?? 0} ✦</span>
			<span class="who">{data.user?.name}</span>
			<form method="POST" action="/auth/logout">
				<button class="ghost">Log out</button>
			</form>
		</div>
	</nav>
</header>

<main>
	{@render children()}
</main>
