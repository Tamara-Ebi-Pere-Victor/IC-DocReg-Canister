import {
    query,
    update,
    text,
    Record,
    StableBTreeMap,
    Variant,
    Vec,
    None,
    Some,
    Ok,
    Err,
    ic,
    Principal,
    Opt,
    nat64,
    int32,
    Duration,
    Result,
    bool,
    Canister,
    blob,
    init,
} from 'azle';
import { Ledger, binaryAddressFromPrincipal, hexAddressFromPrincipal } from 'azle/canisters/ledger';
import { v4 as uuidv4 } from 'uuid';
import encodeUtf8 from 'encode-utf8';

// Define types for records and variants
type Document = Record<{
    id: text;
    name: text;
    hash: blob;
    createdAt: nat64;
    owner: Principal;
}>;

type AddDocumentPayload = Record<{
    name: text;
    hash: text;
}>;

type VerifyDocumentPayload = Record<{
    hash: text;
}>;

type InitPayload = Record<{
    addDocFee: nat64;
    verifyDocFee: nat64;
}>;

type PaymentOrderStatus = Variant<{
    PaymentPending: text;
    Completed: text;
}>;

type PaymentOrder = Record<{
    orderId: text;
    fee: nat64;
    status: PaymentOrderStatus;
    payer: Principal;
    paid_at_block: Opt<nat64>;
    memo: nat64;
}>;

type Message = Variant<{
    Exists: text;
    NotFound: text;
    InvalidPayload: text;
    PaymentFailed: text;
    PaymentCompleted: text;
    Success: text;
    Fail: text;
}>;

// Define storage maps
const id2HashStorage = StableBTreeMap<number, text, blob>(0);
const hash2DocStorage = StableBTreeMap<number, blob, Document>(1);
const userDocMap = StableBTreeMap<number, Principal, Vec<text>>(2);
const persistedOrders = StableBTreeMap<number, Principal, PaymentOrder>(1);
const pendingOrders = StableBTreeMap<number, nat64, PaymentOrder>(2);

const ORDER_RESERVATION_PERIOD: Duration = 120n; // reservation period in seconds

const icpCanister = Ledger(Principal.fromText('ryjl3-tyaaa-aaaaa-aaaba-cai'));

export default Canister({
    init: init([InitPayload], (payload) => {
        if (payload.addDocFee <= 0 || payload.verifyDocFee <= 0) {
            ic.trap('Fees must be greater than 0 ICP');
        }

        addDocFee = Some(payload.addDocFee);
        verifyDocFee = Some(payload.verifyDocFee);
        nextDocId = Some(0);
    }),

    createAddDocumentOrder: update([], Result<PaymentOrder, Message>, () => {
        const orderId = uuidv4();

        if (addDocFee === None) {
            return Err({ NotFound: 'Add document fee not set' });
        }

        const paymentOrder: PaymentOrder = {
            orderId,
            fee: addDocFee,
            status: { PaymentPending: 'PAYMENT_PENDING' },
            payer: ic.caller(),
            paid_at_block: None,
            memo: generateCorrelationId(orderId),
        };

        pendingOrders.insert(paymentOrder.memo, paymentOrder);
        discardByTimeout(paymentOrder.memo, ORDER_RESERVATION_PERIOD);
        return Ok(paymentOrder);
    }),

    addDocument: update(
        [AddDocumentPayload, text, nat64, nat64],
        Result<Message, Message>,
        async (payload, paymentId, block, memo) => {
            const caller = ic.caller();

            if (addDocFee === None) {
                return Err({ NotFound: 'Add document fee not set' });
            }

            if (nextDocId === None) {
                return Err({ NotFound: 'Next document ID not set' });
            }

            const paymentVerified = await verifyPaymentInternal(
                caller,
                addDocFee,
                block,
                memo
            );

            if (!paymentVerified) {
                return Err({
                    NotFound: `Cannot complete the payment: Cannot verify the payment, memo=${memo}`,
                });
            }

            const pendingOrderOpt = pendingOrders.remove(memo);

            if (pendingOrderOpt === None) {
                return Err({
                    NotFound: `Cannot complete the payment: There is no pending order with ID=${paymentId}`,
                });
            }

           const order = pendingOrderOpt.Some;
			const updatedOrder = {
				...order,
				status: { Completed: 'COMPLETED' },
				paid_at_block: Some(block),
			};

			// get encodedhash of payload
			let encodedHash = stringToBlob(payload.hash);

			const id = nextDocId.Some.toString();
			const document = {
				id,
				name: payload.name,
				hash: encodedHash,
				createdAt: ic.time(),
				owner: caller,
			};

			// check if hash exists
			if (!('None' in hash2DocStorage.get(encodedHash))) {
				return Err({ Exists: 'document hash exists on registry' });
			}

			// update records
			id2HashStorage.insert(id, encodedHash);
			hash2DocStorage.insert(encodedHash, document);

			persistedOrders.insert(ic.caller(), updatedOrder);

			// get user doc map and update
			let userDocsOpt = userDocMap.get(caller);

			if ('None' in userDocsOpt) {
				let newMap: Vec<text> = [id.toString()];
				userDocMap.insert(caller, newMap);
			} else {
				let updatedMap = [...userDocsOpt.Some, id.toString()];
				userDocMap.insert(caller, updatedMap);
			}

			// increment doc id
			nextDocId = Some(nextDocId.Some + 1);
			return Ok({ Success: `doc with id ${id} added` });
        }
    ),

   createVerifyDocumentOrder: update([], Result(PaymentOrder, Message), () => {
		let orderId = uuidv4();

		if ('None' in verifyDocFee) {
			return Err({ NotFound: 'verify doc fee not set' });
		}

		const paymentOrder = {
			orderId,
			fee: verifyDocFee.Some,
			status: { PaymentPending: 'PAYMENT_PENDING' },
			payer: ic.caller(),
			paid_at_block: None,
			memo: generateCorrelationId(orderId),
		};

		// store and return order
		pendingOrders.insert(paymentOrder.memo, paymentOrder);
		discardByTimeout(paymentOrder.memo, ORDER_RESERVATION_PERIOD);
		return Ok(paymentOrder);
	}),

	verifyDocument: update(
		[VerifyDocumentPayload, text, nat64, nat64],
		Result(Message, Message),
		async (payload, paymentId, block, memo) => {
			const caller = ic.caller();

			// check that fees are set
			if ('None' in verifyDocFee) {
				return Err({ NotFound: 'add doc fee not set' });
			}

			// verify payment and fail if payment not found
			const paymentVerified = await verifyPaymentInternal(
				caller,
				verifyDocFee.Some,
				block,
				memo
			);
			if (!paymentVerified) {
				return Err({
					NotFound: `cannot complete the payment: cannot verify the payment, memo=${memo}`,
				});
			}

			// update order record from pending to persisted
			const pendingOrderOpt = pendingOrders.remove(memo);
			if ('None' in pendingOrderOpt) {
				return Err({
					NotFound: `cannot complete the payment: there is no pending order with id=${paymentId}`,
				});
			}
			const order = pendingOrderOpt.Some;
			const updatedOrder = {
				...order,
				status: { Completed: 'COMPLETED' },
				paid_at_block: Some(block),
			};

			// get encodedhash of payload
			let encodedHash = stringToBlob(payload.hash);

			let docOpt = hash2DocStorage.get(encodedHash);

			persistedOrders.insert(ic.caller(), updatedOrder);

			if ('None' in docOpt) {
				return Err({ NotFound: 'document not on registry' });
			} else {
				return Ok({
					Exists: `document found with name ${docOpt.Some.name} created at ${docOpt.Some.createdAt}`,
				});
			}
		}
	),

	// return a list of docs added by user
	getUserDocs: query([Principal], Vec(text), (user) => {
		let userdocsOpt = userDocMap.get(user);
		// check if list is empty
		if ('None' in userdocsOpt) {
			return [];
		}
		return userdocsOpt.Some;
	}),

	// allows doc adders to view their added document
	viewDocument: query([Principal, text], Result(Document, Message), (user, documentId) => {
		// get list of docs from map
		let userdocsOpt = userDocMap.get(user);

		// check if list is empty
		if ('None' in userdocsOpt) {
			return Err({ NotFound: `you do not have access to document with id=${documentId}` });
		}

		let userDocs = userdocsOpt.Some;

		// check if list contains specified doc id
		if (!userDocs.includes(documentId)) {
			return Err({ NotFound: `you do not have access to document with id=${documentId}` });
		}

		// get the document data
		const docHashOpt = id2HashStorage.get(documentId);

		if ('None' in docHashOpt) {
			return Err({ NotFound: `document hash with id=${documentId} not found` });
		}

		const documentOpt = hash2DocStorage.get(docHashOpt.Some);

		if ('None' in documentOpt) {
			return Err({ NotFound: `document with id=${documentId} not found` });
		}

		return Ok(documentOpt.Some);
	}),

	deleteDocument: update([text], Result(Message, Message), (documentId) => {
		let caller = ic.caller();

		// get list of docs from map
		let userdocsOpt = userDocMap.get(caller);

		// check if list is empty
		if ('None' in userdocsOpt) {
			return Err({ NotFound: `you do not have access to document with id=${documentId}` });
		}

		let userDocs = userdocsOpt.Some;

		// check if list contains specified doc id
		if (!userDocs.includes(documentId)) {
			return Err({ NotFound: `you do not have access to document with id=${documentId}` });
		}

		// get index of documentId
		let idIndex = userDocs.indexOf(documentId);

		if (idIndex > -1) {
			userDocs.splice(idIndex, 1);
		} else {
			return Err({ NotFound: `error deleting document with id=${documentId}` });
		}

		// update user mapping
		userDocMap.insert(caller, userDocs);

		// next delete docs from storage
		let removedDocHash = id2HashStorage.remove(documentId);

		if ('None' in removedDocHash) {
			return Err({ NotFound: `error in deleting doc hash with id=${documentId}` });
		}

		let removedDoc = hash2DocStorage.remove(removedDocHash.Some);

		if ('None' in removedDoc) {
			return Err({ NotFound: `error in deleting doc data with id=${documentId}` });
		}

		return Ok({ Success: 'document removed successfully' });
	}),

	// a helper function to get canister address from the principal
	getCanisterAddress: query([], text, () => {
		let canisterPrincipal = ic.id();
		return hexAddressFromPrincipal(canisterPrincipal, 0);
	}),

	// a helper function to get address from the principal
	getAddressFromPrincipal: query([Principal], text, (principal) => {
		return hexAddressFromPrincipal(principal, 0);
	}),

	// get add document fee
	getAddDocumentFee: query([], nat64, () => {
		if ('None' in addDocFee) {
			return BigInt(0);
		}

		return addDocFee.Some;
	}),

	// get verificationFee
	getVerificationFee: query([], nat64, () => {
		if ('None' in verifyDocFee) {
			return BigInt(0);
		}
		return verifyDocFee.Some;
	}),

	// get count of documents
	getTotalDocs: query([], int32, () => {
		if ('None' in nextDocId) {
			return 0;
		}
		return nextDocId.Some;
	}),
});

/*
    a hash function that is used to generate correlation ids for orders.
    also, we use that in the verifyPayment function where we check if the used has actually paid the order
*/
function hash(input: any): nat64 {
	return BigInt(Math.abs(hashCode().value(input)));
}

// a workaround to make uuid package work with Azle
globalThis.crypto = {
	// @ts-ignore
	getRandomValues: () => {
		let array = new Uint8Array(32);

		for (let i = 0; i < array.length; i++) {
			array[i] = Math.floor(Math.random() * 256);
		}

		return array;
	},
};

function generateCorrelationId(productId: text): nat64 {
    const correlationId = `${productId}_${ic.caller().toText()}_${ic.time()}`;
    return hash(correlationId);
}

function discardByTimeout(memo: nat64, delay: Duration) {
    ic.setTimer(delay, () => {
        const order = pendingOrders.remove(memo);
        console.log(`Order discarded ${order}`);
    });
}

async function verifyPaymentInternal(
    caller: Principal,
    amount: nat64,
    block: nat64,
    memo: nat64
): Promise<bool> {
   const blockData = await ic.call(icpCanister.query_blocks, {
		args: [{ start: block, length: 1n }],
	});
	const tx = blockData.blocks.find((block) => {
		if ('None' in block.transaction.operation) {
			return false;
		}
		const operation = block.transaction.operation.Some;
		const senderAddress = binaryAddressFromPrincipal(caller, 0);
		const receiverAddress = binaryAddressFromPrincipal(ic.id(), 0);
		return (
			block.transaction.memo === memo &&
			hash(senderAddress) === hash(operation.Transfer?.from) &&
			hash(receiverAddress) === hash(operation.Transfer?.to) &&
			amount === operation.Transfer?.amount.e8s
		);
	});
	return tx ? true : false;
}

function stringToBlob(string: string): blob {
    return new Uint8Array(encodeUtf8(string));
}
