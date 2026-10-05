<script lang="ts">
	import { enhance } from '$app/forms';
	import ActionModal from '$lib/components/ActionModal.svelte';

	let { data, form } = $props();

	let cartOpen = $state(true);
	let balance = $derived(data.user?.balance ?? 0);
	let canAfford = $derived(data.cartTotal <= balance);
</script>

<svelte:head>
	<title>Gamedev Shop</title>
</svelte:head>

<h1>Shop</h1>

{#if form?.message}<p class="flash error">{form.message}</p>{/if}
{#if form?.success}<p class="flash ok">{form.success}</p>{/if}

<div class="shop-layout">
	<div>
		{#if data.items.length === 0}
			<p class="muted">Nothing for sale yet — check back soon!</p>
		{:else}
			<div class="grid">
				{#each data.items as item (item.id)}
					<article class="card" class:locked={item.locked}>
						{#if item.image}
							<img class="thumb" src={item.image} alt={item.name} />
						{:else}
							<div class="thumb">🕹️</div>
						{/if}
						<div class="body">
							<h3>{item.name}</h3>
							{#if item.description}
								<p class="desc">{item.description}</p>
							{/if}
							{#if item.locked}
								<p class="muted">🔒 Locked for you</p>
							{:else if item.alreadyPurchased}
								<p class="muted">Already bought — limit one per person</p>
							{/if}
							<footer>
								<span class="price">{item.price} ✦</span>
								<form method="POST" action="?/addToCart" use:enhance>
									<input type="hidden" name="id" value={item.id} />
									<button disabled={item.locked || item.alreadyPurchased}>
										{item.locked ? 'Locked' : item.alreadyPurchased ? 'Already bought' : 'Add to cart'}
									</button>
								</form>
							</footer>
						</div>
					</article>
				{/each}
			</div>
		{/if}
	</div>

	<div class="sidebar">
		<aside class="panel">
			<div class="row" style="justify-content: space-between">
				<h2 style="margin: 0">Your cart</h2>
				<button class="ghost" onclick={() => (cartOpen = !cartOpen)}>
					{cartOpen ? 'Hide' : 'Show'}
				</button>
			</div>

			{#if cartOpen}
				{#if data.cart.length === 0}
					<p class="muted">Your cart is empty.</p>
				{:else}
					<ul class="cart-lines">
						{#each data.cart as line (line.id)}
							<li>
								{#if line.item.image}
									<img class="cart-thumb" src={line.item.image} alt={line.item.name} />
								{:else}
									<div class="cart-thumb">🕹️</div>
								{/if}
								<div class="cart-line-info">
									<strong>{line.item.name}</strong>
									<span class="price">{line.item.price} ✦</span>
									<form method="POST" action="?/remove" use:enhance>
										<input type="hidden" name="id" value={line.id} />
										<button class="link">Remove</button>
									</form>
								</div>
								<div class="stepper">
									<form method="POST" action="?/setQty" use:enhance>
										<input type="hidden" name="id" value={line.id} />
										<input type="hidden" name="qty" value={line.qty - 1} />
										<button class="ghost" aria-label="One less {line.item.name}">−</button>
									</form>
									<span>{line.qty}</span>
									<form method="POST" action="?/setQty" use:enhance>
										<input type="hidden" name="id" value={line.id} />
										<input type="hidden" name="qty" value={line.qty + 1} />
										<button
											class="ghost"
											aria-label="One more {line.item.name}"
											disabled={line.item.limitOne && line.qty >= 1}
										>
											+
										</button>
									</form>
								</div>
							</li>
						{/each}
					</ul>

					<p class="cart-summary">
						Cart total: <span class="price">{data.cartTotal} ✦</span><br />
						Your balance: <span class="price">{balance} ✦</span>
					</p>
					{#if !canAfford}
						<p class="cart-warning">Not enough credits to complete this order.</p>
					{/if}
					<form method="POST" action="?/checkout" use:enhance>
						<button disabled={!canAfford} style="width: 100%">Confirm order</button>
					</form>
				{/if}
			{/if}
		</aside>

		{#if data.orders.length > 0}
			<aside class="panel">
				<h2 style="margin: 0 0 0.75rem">Your orders</h2>
				<div class="order-list">
					{#each data.orders as o (o.id)}
						<div class="order">
							<div class="row" style="justify-content: space-between">
								<strong>#{o.id}</strong>
								{#if o.cancelledAt}
									<span class="chip cancelled">Cancelled</span>
								{:else if o.fulfilledAt}
									<span class="chip ok">Fulfilled</span>
								{:else}
									<span class="chip pending">Pending</span>
								{/if}
							</div>
							<ul class="order-lines">
								{#each o.lines as line (line.id)}
									<li>{line.qty}× {line.itemName}</li>
								{/each}
							</ul>
							<div class="row" style="justify-content: space-between">
								<span class="muted">{o.createdAt.toLocaleDateString()}</span>
								<span class="price">{o.total} ✦</span>
							</div>
							{#if o.comments}
								<p class="order-comments">📦 {o.comments}</p>
							{/if}
							{#if o.cancelReason}
								<p class="muted reason">“{o.cancelReason}”</p>
							{/if}
							{#if !o.cancelledAt && !o.fulfilledAt}
								<ActionModal
									trigger="Cancel order"
									triggerClass="danger"
									title="Cancel this order?"
									placeholder="Reason (optional)"
									field="reason"
									action="?/cancel"
									submitLabel="Cancel order"
									orderId={o.id}
								/>
							{/if}
						</div>
					{/each}
				</div>
			</aside>
		{/if}
	</div>
</div>
