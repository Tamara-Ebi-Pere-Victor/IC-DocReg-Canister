import { transferICP } from './ledger';

export async function getTotalDocs() {
	try {
		return await window.canister.docreg.getTotalDocs();
	} catch (err) {
		if (err.name === 'AgentHTTPResponseError') {
			const authClient = window.auth.client;
			await authClient.logout();
		}
		return 0;
	}
}

export async function getAddDocumentFee() {
	try {
		return await window.canister.docreg.getAddDocumentFee();
	} catch (err) {
		if (err.name === 'AgentHTTPResponseError') {
			const authClient = window.auth.client;
			await authClient.logout();
		}
		return 0;
	}
}
export async function getVerificationFee() {
	try {
		return await window.canister.docreg.getVerificationFee();
	} catch (err) {
		if (err.name === 'AgentHTTPResponseError') {
			const authClient = window.auth.client;
			await authClient.logout();
		}
		return 0;
	}
}

export async function getUserDocs() {
	try {
		const address = window.auth.principal;
		const userDocs = await window.canister.docreg.getUserDocs(address);
		let documents = [];
		for (let i of userDocs) {
			let doc = await viewDocument(i);
			documents.push(doc);
		}
		return documents;
	} catch (err) {
		if (err.name === 'AgentHTTPResponseError') {
			const authClient = window.auth.client;
			await authClient.logout();
		}
		return [];
	}
}

async function viewDocument(documentId) {
	try {
		const address = window.auth.principal;

		const result = await window.canister.docreg.viewDocument(address, documentId);
		if (result.Err) {
			throw new Error(result.Err);
		}
		return result.Ok;
	} catch (err) {
		if (err.name === 'AgentHTTPResponseError') {
			const authClient = window.auth.client;
			await authClient.logout();
		}
		return {};
	}
}

export async function addDocument(document) {
	const docregCanister = window.canister.docreg;
	const orderResponse = await docregCanister.createAddDocumentOrder();
	const canisterAddress = await docregCanister.getCanisterAddress();
	const block = await transferICP(canisterAddress, orderResponse.Ok.fee, orderResponse.Ok.memo);
	const result = await docregCanister.addDocument(
		document,
		orderResponse.Ok.orderId,
		block,
		orderResponse.Ok.memo
	);

	if (result.Err) {
		throw new Error(result.Err);
	}
	return result.Ok;
}

export async function verifyDocument(document) {
	const docregCanister = window.canister.docreg;
	const orderResponse = await docregCanister.createVerifyDocumentOrder();
	const canisterAddress = await docregCanister.getCanisterAddress();
	const block = await transferICP(canisterAddress, orderResponse.Ok.fee, orderResponse.Ok.memo);
	const result = await docregCanister.verifyDocument(
		document,
		orderResponse.Ok.orderId,
		block,
		orderResponse.Ok.memo
	);

	if (result.Err) {
		throw new Error(result.Err);
	}
	return result.Ok;
}

export async function deleteDocument(documentId) {
	const result = await window.canister.docreg.deleteDocument(documentId);
	if (result.Err) {
		throw new Error(result.Err);
	}
	return result.Ok;
}
