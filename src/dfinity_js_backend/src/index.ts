import { $query, $update, Record, StableBTreeMap, Variant, Vec, match, ic, Principal, Opt, nat64, Duration } from 'azle';
import {
    Ledger, QueryBlocksResponse, binaryAddressFromAddress, binaryAddressFromPrincipal, hexAddressFromPrincipal
} from 'azle/canisters/ledger';
import { hashCode } from 'hashcode';

/**
 * This type represents a product that can be listed on a marketplace.
 * It contains basic properties that are needed to define a product.
 */
type Product = Record<{
    id: nat64;
    title: string;
    description: string;
    location: string;
    price: nat64;
    seller: string;
    attachmentURL: string;
    soldAmount: nat64;
}>;

type ProducPayload = Record<{
    title: string;
    description: string;
    location: string;
    price: nat64;
    attachmentURL: string;
}>;

type Order = Record<{
    productId: nat64;
    price: nat64;
    status: string;
    seller: string;
    paid_at_block: Opt<nat64>;
    memo: nat64;
}>;

type Response = Variant<{
    error: string;
    product: Product;
    order: Order;
    caller: string;
    products: Vec<Product>;
    orders: Vec<Vec<Order>>;
    pendingOrders: Vec<Order>;
    id: nat64;
    icpTransferResult: string;
}>;

enum Message {
    NotFound = "PRODUCT_NOT_FOUND",
    InvalidPayload = "INVALID_PAYLOAD",
    PaymentFailed = "PAYMENT_FAILED",
    PaymentCompleted = "PAYMENT_COMPLETED",
};

enum OrderStatus {
    PaymentPending = "PAYMENT_PENDING",
    Completed = "COMPLETED"
}

let idCounter: nat64 = 0n;

/**
 * `productsStorage` - it's a key-value datastructure that is used to store products by sellers.
 * {@link StableBTreeMap} is a self-balancing tree that acts as a durable data storage that keeps data across canister upgrades.
 * For the sake of this contract we've chosen {@link StableBTreeMap} as a storage for the next reasons:
 * - `insert`, `get` and `remove` operations have a constant time complexity - O(1)
 * 
 * Brakedown of the `StableBTreeMap<string, Product>` datastructure:
 * - the key of map is a `productId`
 * - the value in this map is a product itself `Product` that is related to a given key (`productId`)
 * 
 * Constructor values:
 * 1) 0 - memory id where to initialize a map
 * 2) 16 - it's a max size of the key in bytes.
 * 3) 1024 - it's a max size of the value in bytes. 
 * 2 and 3 are not being used directly in the constructor but the Azle compiler utilizes these values during compile time
 */
const productsStorage = new StableBTreeMap<nat64, Product>(0, 16, 1024);
const persistedOrders = new StableBTreeMap<string, Vec<Order>>(1, 71, 4096);
const pendingOrders = new StableBTreeMap<nat64, Order>(2, 16, 4096);

const ORDER_RESERVATION_PERIOD = 120n; // reservation period in seconds

/* 
    initialization of the Ledger canister. The principal text value is hardcoded because 
    we set it in the `dfx.json`
*/
const icpCanister = new Ledger(Principal.fromText("ryjl3-tyaaa-aaaaa-aaaba-cai"));

$query;
export function getProducts(): Response {
    return { products: productsStorage.values() };
}

$query;
export function getOrders(): Response {
    return { orders: persistedOrders.values() };
}

$query;
export function getPendingOrders(): Response {
    return { pendingOrders: pendingOrders.values() };
}

$query;
export function getProduct(id: nat64): Response {
    let response: Response;
    return match(productsStorage.get(id), {
        Some: (product) => response = { product: product },
        None: () => response = { error: Message.NotFound }
    });
}

$update;
export function addProduct(payload: ProducPayload): Response {
    if (typeof payload != 'object' || Object.keys(payload).length === 0) {
        return { error: Message.InvalidPayload };
    }
    idCounter += 1n;
    let product: Product = { id: idCounter, soldAmount: 0n, seller: ic.caller().toText(), ...payload };
    productsStorage.insert(product.id, product);
    return { product };
};

/*
    on create order we generate a hashcode of the order and then use this number as corelation id (memo) in the transfer function
    the memo is later used to identify a payment for this particular order.

    The entire flow is divided into the three main parts:
        1. Create an order
        2. Pay for the order (transfer ICP to the seller). 
        3. Complete the order (use memo from step 1 and the transaction block from step 2)
        
    Step 2 is done on the FE app because we cannot create an order and transfer ICP in the scope of the single method. 
    When we call the `createOrder` method, the ic.caller() would the principal of the identity which initiated this call in the frontend app. 
    However, if we call `ledger.transfer()` from `createOrder` function, the principal of the original caller won't be passed to the 
    ledger canister when we make this call. 
    In this case, when we call `ledger.transfer()` from the `createOrder` method,
    the caller identity in the `ledger.transfer()` would be the principal of the canister from which we just made this call - in our case it's the marketplace canister.
    That's we split this flow into three parts.
*/
$update
export function createOrder(id: nat64): Response {
    let response: Response;
    return match(productsStorage.get(id), {
        Some: (product) => {
            const order: Order = {
                productId: product.id,
                price: product.price,
                status: OrderStatus.PaymentPending,
                seller: product.seller,
                paid_at_block: Opt.None,
                memo: generateCorrelationId(id)
            };
            pendingOrders.insert(order.memo, order);
            discardByTimeout(order.memo, ORDER_RESERVATION_PERIOD);
            return response = { order: order };
        },
        None: () => {
            return response = { error: Message.NotFound };
        }
    });
}

function generateCorrelationId(productId: nat64): nat64 {
    const correlationId = `${productId}_${ic.caller().toText()}_${ic.time()}`;
    return hash(correlationId);
}

/*
    after the order is created, we give the `delay` amount of minutes to pay for the order.
    if it's not paid during this timeframe, the order is automatically removed from the pending orders.
*/
function discardByTimeout(memo: nat64, delay: Duration) {
    ic.setTimer(delay, () => {
        const order = pendingOrders.remove(memo);
        console.log(`Order discarded ${order}`);
    });
}

$update;
export async function completePurchase(seller: Principal, id: nat64, price: nat64, block: nat64, memo: nat64): Promise<Response> {
    let response: Response;
    const paymentVerified = await verifyPayment(seller, price, block, memo);
    if (!paymentVerified) {
        return response = { error: Message.NotFound };
    }
    return match(pendingOrders.remove(memo), {
        Some: (order) => {
            order.status = OrderStatus.Completed;
            order.paid_at_block = Opt.Some(block);
            updateSoldAmount(id);
            persistOrder(ic.caller().toText(), order);
            return response = {order};
        },
        None: () => response = { error: Message.NotFound }
    });
}

function persistOrder(principal: string, order: Order) {
    match(persistedOrders.get(principal), {
        Some: (orders) => {
            orders.push(order);
            persistedOrders.insert(principal, orders);
        },
        None: () => {
            let principalOrders: Order[] = [];
            principalOrders.push(order);
            persistedOrders.insert(principal, principalOrders);
        }
    });
}

/*
    another example of a canister-to-canister communication
    here we call the `query_blocks` function on the ledger canister
    to get a single block with the given number `start`.
    The `length` parameter is set to 1 to limit the return amount of blocks.
    In this function we verify all the details about the transaction to make sure that we can mark the order as completed
*/
$query;
export async function verifyPayment(receiver: Principal, amount: nat64, block: nat64, memo: nat64): Promise<boolean> {
    return match(await icpCanister.query_blocks({ start: block, length: 1n }).call(), {
        Ok: (blockData: QueryBlocksResponse) => {
            const tx = blockData.blocks.find((block) => {
                return match(block.transaction.operation, {
                    Some: (operation) => {
                        const senderAddress = binaryAddressFromPrincipal(ic.caller(), 0);
                        const receiverAddress = binaryAddressFromPrincipal(receiver, 0);
                        return block.transaction.memo === memo &&
                            hash(senderAddress) === hash(operation.Transfer?.from) &&
                            hash(receiverAddress) === hash(operation.Transfer?.to) &&
                            amount === operation.Transfer?.amount.e8s;
                    },
                    None: () => false
                });
            });
            return tx ? true : false;
        },
        Err: (err) => false
    });
}

function updateSoldAmount(productId: nat64) {
    return match(productsStorage.get(productId), {
        Some: (product) => {
            product.soldAmount += 1n;
            productsStorage.insert(product.id, product);
        },
        None: () => { throw Error(Message.NotFound) }
    });
}

// not used right now. can be used for transfers from the canister for instances when a marketplace can hold a balance account for users
async function makePayment(to: string, amount: nat64): Promise<Response> {
    let response: Response;
    const toPrincipal = Principal.fromText(to);
    const toAddress = hexAddressFromPrincipal(toPrincipal, 0);
    const transferFee = await getIcpTransferFee();
    const transferResult = await icpCanister
        .transfer({
            memo: 0n,
            amount: {
                e8s: amount
            },
            fee: {
                e8s: transferFee
            },
            from_subaccount: Opt.None,
            to: binaryAddressFromAddress(toAddress),
            created_at_time: Opt.None
        })
        .call()
    return match(transferResult, {
        Ok: (_) => response = { icpTransferResult: Message.PaymentCompleted },
        Err: (err) => response = { error: Message.PaymentFailed }
    });
}

// here we perform a canister-to-canister call where we talk to the ledger canister to get the value of the transfer_fee
async function getIcpTransferFee() {
    const transferFee = await icpCanister.transfer_fee({}).call();
    return match(transferFee, {
        Ok: (result) => result.transfer_fee.e8s,
        Err: (err) => -1n //
    });
}

$update;
export function updateProduct(payload: Product): Response {
    let response: Response;
    return match(productsStorage.get(payload.id), {
        Some: (product) => {
            productsStorage.insert(product.id, payload);
            return response = { product: payload };
        },
        None: () => response = { error: Message.NotFound }
    });
};

$update;
export function deleteProduct(id: nat64): Response {
    let response: Response;
    return match(productsStorage.remove(id), {
        Some: (deletedProduct) => response = { id: deletedProduct.id },
        None: () => response = { error: Message.NotFound }
    });
};

/*
    a helper function to get address from the principal
    the address is later used in the transfer method
*/
$query;
export function getAddressFromPrincipal(principal: Principal): string {
    return hexAddressFromPrincipal(principal, 0);
}

/*
    a hash function that is used to generate correlation ids for orders.
    also, we use that in the verifyPayment function where we check if the used has actually paid the order
*/
function hash(input: any): nat64 {
    return BigInt(Math.abs(hashCode().value(input)));
}