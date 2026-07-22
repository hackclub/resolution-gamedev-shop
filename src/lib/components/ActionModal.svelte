<script lang="ts">
	import { enhance } from '$app/forms';

	let {
		trigger,
		triggerClass = '',
		title,
		placeholder,
		field,
		action,
		submitLabel,
		orderId,
		initial = ''
	}: {
		trigger: string;
		triggerClass?: string;
		title: string;
		placeholder: string;
		field: string;
		action: string;
		submitLabel: string;
		orderId: number;
		initial?: string;
	} = $props();

	let dialog: HTMLDialogElement | undefined = $state();
</script>

<button class={triggerClass} onclick={() => dialog?.showModal()}>{trigger}</button>

<dialog bind:this={dialog}>
	<form
		method="POST"
		{action}
		use:enhance={() => {
			dialog?.close();
			return async ({ update }) => update();
		}}
	>
		<h3>{title}</h3>
		<input type="hidden" name="id" value={orderId} />
		<textarea name={field} rows="3" maxlength="1000" {placeholder}>{initial}</textarea>
		<div class="row" style="justify-content: flex-end; margin-top: 0.75rem">
			<button type="button" class="ghost" onclick={() => dialog?.close()}>Never mind</button>
			<button type="submit" class={triggerClass}>{submitLabel}</button>
		</div>
	</form>
</dialog>
