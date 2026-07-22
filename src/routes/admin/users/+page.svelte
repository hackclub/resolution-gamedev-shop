<script lang="ts">
	import { enhance } from '$app/forms';

	let { data, form } = $props();
</script>

<svelte:head>
	<title>Admin · Users</title>
</svelte:head>

<h1>Users &amp; currency</h1>

{#if form?.message}<p class="flash error" style="white-space: pre-line">{form.message}</p>{/if}
{#if form?.success}<p class="flash ok">{form.success}</p>{/if}

<section class="panel">
	<h2 style="margin-top: 0">Bulk issue</h2>
	<p class="muted">
		One person per line: <code>email,amount</code> (comma, semicolon, or tab delimited — pasting
		two columns from a spreadsheet works). Negative amounts deduct. Nothing is applied unless
		every row is valid.
	</p>
	<form method="POST" action="?/bulkIssue" use:enhance>
		<label>
			<span>Rows</span>
			<textarea
				name="rows"
				rows="6"
				required
				placeholder={'student1@school.org,50\nstudent2@school.org,50\nstudent3@school.org,-10'}
			></textarea>
		</label>
		<button>Apply to all</button>
	</form>
</section>

<p class="muted">
	Users appear here after their first login. Enter an amount and press Issue — use a negative
	amount to deduct.
</p>

{#if data.users.length === 0}
	<p class="muted">No one has logged in yet.</p>
{:else}
	<table>
		<thead>
			<tr><th>Name</th><th>Email</th><th>Balance</th><th>Issue currency</th></tr>
		</thead>
		<tbody>
			{#each data.users as u (u.email)}
				<tr>
					<td>{u.name}</td>
					<td class="muted">{u.email}</td>
					<td class="price">{u.balance} ✦</td>
					<td>
						<form method="POST" action="?/issue" use:enhance class="row">
							<input type="hidden" name="email" value={u.email} />
							<input
								name="amount"
								type="number"
								step="1"
								required
								placeholder="e.g. 50"
								style="width: 6.5rem"
							/>
							<button>Issue</button>
						</form>
					</td>
				</tr>
			{/each}
		</tbody>
	</table>
{/if}
