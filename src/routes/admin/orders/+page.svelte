<script lang="ts">
	import { enhance } from '$app/forms';
	import ActionModal from '$lib/components/ActionModal.svelte';

	let { data, form } = $props();

	type Status = 'pending' | 'fulfilled' | 'cancelled';
	type Filter = 'all' | Status;

	function statusOf(o: (typeof data.orders)[number]): Status {
		if (o.cancelledAt) return 'cancelled';
		if (o.fulfilledAt) return 'fulfilled';
		return 'pending';
	}

	let filter = $state<Filter>('all');
	let counts = $derived({
		all: data.orders.length,
		pending: data.orders.filter((o) => statusOf(o) === 'pending').length,
		fulfilled: data.orders.filter((o) => statusOf(o) === 'fulfilled').length,
		cancelled: data.orders.filter((o) => statusOf(o) === 'cancelled').length
	});
	let visible = $derived(
		filter === 'all' ? data.orders : data.orders.filter((o) => statusOf(o) === filter)
	);
</script>

<svelte:head>
	<title>Admin · Orders</title>
</svelte:head>

<h1>Orders</h1>

{#if form?.message}<p class="flash error">{form.message}</p>{/if}

<div class="filters">
	{#each ['all', 'pending', 'fulfilled', 'cancelled'] as const as f (f)}
		<button class:ghost={filter !== f} onclick={() => (filter = f)}>
			{f[0].toUpperCase() + f.slice(1)} ({counts[f]})
		</button>
	{/each}
</div>

{#if visible.length === 0}
	<p class="muted">No {filter === 'all' ? '' : filter} orders.</p>
{:else}
	<table>
		<thead>
			<tr>
				<th>#</th><th>Who</th><th>Items</th><th>Total</th><th>When</th><th>Status</th>
				<th>Notes</th><th></th>
			</tr>
		</thead>
		<tbody>
			{#each visible as o (o.id)}
				<tr>
					<td>{o.id}</td>
					<td>
						{o.userName ?? o.userEmail}
						<div class="muted" style="font-size: 0.8rem">{o.userEmail}</div>
					</td>
					<td>
						<ul class="order-lines">
							{#each o.lines as line (line.id)}
								<li>{line.qty}× {line.itemName}</li>
							{/each}
						</ul>
					</td>
					<td class="price">{o.total} ✦</td>
					<td class="muted">{o.createdAt.toLocaleString()}</td>
					<td>
						{#if o.cancelledAt}
							<span class="chip cancelled">Cancelled</span>
							<div class="muted reason">
								by {o.cancelledBy === o.userEmail ? 'user' : 'admin'}
								{#if o.cancelReason}— “{o.cancelReason}”{/if}
							</div>
						{:else if o.fulfilledAt}
							<span class="chip ok">Fulfilled</span>
						{:else}
							<span class="chip pending">Pending</span>
						{/if}
					</td>
					<td>
						{#if o.comments}
							<span class="muted reason">📦 {o.comments}</span>
						{:else}
							<span class="muted">—</span>
						{/if}
					</td>
					<td>
						{#if o.cancelledAt}
							<!-- nothing to do -->
						{:else if o.fulfilledAt}
							<form method="POST" action="?/unfulfill" use:enhance>
								<input type="hidden" name="id" value={o.id} />
								<button class="ghost">Undo</button>
							</form>
						{:else}
							<div class="row">
								<ActionModal
									trigger="Mark fulfilled"
									title="Any extra comments?"
									placeholder="e.g. a tracking URL — or just continue (optional)"
									field="comments"
									action="?/fulfill"
									submitLabel="Fulfill"
									orderId={o.id}
									initial={o.comments ?? ''}
								/>
								<ActionModal
									trigger="Cancel"
									triggerClass="danger"
									title="Cancel this order?"
									placeholder="Reason (optional)"
									field="reason"
									action="?/cancel"
									submitLabel="Cancel order"
									orderId={o.id}
								/>
							</div>
						{/if}
					</td>
				</tr>
			{/each}
		</tbody>
	</table>
{/if}
