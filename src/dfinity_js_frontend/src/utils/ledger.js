import { AccountIdentifier } from '@dfinity/nns';

export async function transferICP(canisterAddress, amount, memo) {
	const canister = window.canister.ledger;
	const account = AccountIdentifier.fromHex(canisterAddress);
	const result = await canister.transfer({
		to: account.toUint8Array(),
		amount: { e8s: amount },
		memo,
		fee: { e8s: 10000n },
		from_subaccount: [],
		created_at_time: [],
	});
	if (result.Err) {
		throw new Error(result.Err);
	}
	return result.Ok;
}

export async function balance() {
	const canister = window.canister.ledger;
	const address = await window.canister.docreg.getAddressFromPrincipal(window.auth.principal);
	const balance = await canister.account_balance_dfx({ account: address });
	return (balance?.e8s / BigInt(10 ** 8)).toString();
}

export async function getDfxAddress() {
	const address = await window.canister.docreg.getAddressFromPrincipal(window.auth.principal);
	return address;
}
