<script lang="ts">
	import { enhance } from '$app/forms';

	let { data, form } = $props();
</script>

<svelte:head>
	<title>Admin · Items</title>
</svelte:head>

<h1>Manage items</h1>

{#if form?.message}<p class="flash error">{form.message}</p>{/if}
{#if form?.success}<p class="flash ok">{form.success}</p>{/if}

<section class="panel">
	<h2 style="margin-top: 0">Add an item</h2>
	<form method="POST" action="?/create" enctype="multipart/form-data" use:enhance>
		<label>
			<span>Name</span>
			<input name="name" required maxlength="100" />
		</label>
		<label>
			<span>Description</span>
			<textarea name="description" rows="3" maxlength="1000"></textarea>
		</label>
		<label>
			<span>Price (✦)</span>
			<input name="price" type="number" min="0" step="1" required />
		</label>
		<label>
			<span>Stock (leave empty for unlimited)</span>
			<input name="stock" type="number" min="0" step="1" placeholder="∞" />
		</label>
		<label>
			<span>Image (PNG, JPEG, WebP, or GIF — optional)</span>
			<input name="image" type="file" accept="image/png,image/jpeg,image/webp,image/gif" />
		</label>
		<button>Add item</button>
	</form>
</section>

<h2>Current items ({data.items.length})</h2>

{#if data.items.length === 0}
	<p class="muted">No items yet — add one above.</p>
{/if}

{#each data.items as item (item.id)}
	<section class="panel">
		<div class="row" style="align-items: flex-start; gap: 1rem">
			{#if item.image}
				<img
					src={item.image}
					alt={item.name}
					style="width: 8rem; border-radius: 0.5rem; object-fit: cover; aspect-ratio: 16/10"
				/>
			{/if}
			<div style="flex: 1">
				<form method="POST" action="?/update" enctype="multipart/form-data" use:enhance>
					<input type="hidden" name="id" value={item.id} />
					<label>
						<span>Name</span>
						<input name="name" required maxlength="100" value={item.name} />
					</label>
					<label>
						<span>Description</span>
						<textarea name="description" rows="2" maxlength="1000">{item.description}</textarea>
					</label>
					<label>
						<span>Price (✦)</span>
						<input name="price" type="number" min="0" step="1" required value={item.price} />
					</label>
					<label>
						<span>Stock (leave empty for unlimited)</span>
						<input name="stock" type="number" min="0" step="1" placeholder="∞" value={item.stock} />
					</label>
					<label>
						<span>Replace image (leave empty to keep the current one)</span>
						<input name="image" type="file" accept="image/png,image/jpeg,image/webp,image/gif" />
					</label>
					<button>Save changes</button>
				</form>
				<form
					method="POST"
					action="?/delete"
					use:enhance
					style="margin-top: 0.5rem"
					onsubmit={(e) => {
						if (!confirm(`Delete “${item.name}”?`)) e.preventDefault();
					}}
				>
					<input type="hidden" name="id" value={item.id} />
					<button class="danger">Delete</button>
				</form>
			</div>
		</div>
	</section>
{/each}
