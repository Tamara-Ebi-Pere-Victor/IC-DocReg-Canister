#!/bin/bash

# Send tokens to your account
# ./run_faucet <amount> <accountIdentifier>"

if [ -z "$1" ] 
then
    echo -e 'Please set amount to fund'
    exit 1
elif [ -z "$2" ] 
then
    echo -e "Please set account identifier from frontend"
    exit 1
fi

dfx identity use minter
dfx canister call ledger_canister send_dfx "(record { memo = 1; amount = record { e8s = $1 }; fee = record { e8s = 0 }; to = \"$2\" })"