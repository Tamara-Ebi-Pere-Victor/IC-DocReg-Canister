import React from 'react';
import { truncateAddress } from '../../../utils/conversions';
import { DOCREG_CANISTER_ID } from '../../../utils/canisterFactory';

export const Home = ({ noOfDocument }) => {
	return (
		<div>
			<section id="viewHome" className="my-5">
				<h1>Document Registry</h1>
				Welcome to the "Document Registry" DApp. This decentralized app runs on the Algorand
				Blockchain network and holds a registry of documents in on chain.
				<ul>
					<li>
						The registry keeps the hashes of the documents along with their publish
						date.
					</li>
					<li>
						<b className="fw-bold">Users</b> can submit new documents to be stored on
						the blockchain.
					</li>
					<li>
						<b className="fw-bold">Users</b> can verify the existence of certain
						document in the registry.
					</li>
					<li>
						Contract <b className="fw-bold">canister</b> (on ICP testnet):{' '}
						{DOCREG_CANISTER_ID}
					</li>
					<li>
						Number of <b className="fw-bold">Documents</b> in registry:{' '}
						<b className="fw-bold">
							<a id="docsInRegistry" href="#">
								{noOfDocument}
							</a>
						</b>{' '}
						Documents
					</li>
				</ul>
			</section>
		</div>
	);
};
