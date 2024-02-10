import React from 'react';
import { Upload } from '../Upload';

export const Submit = ({ getBalance, getUserDocs }) => {
	return (
		<div className="my-5">
			<h5 className="fw-bold">Submit a Document</h5>
			<p>
				Users can register (upload) new documents to the "Document Registry" canister on the
				ICP blockchain decentralized network.
			</p>
			<div>
				<Upload id="documentForUpload" getBalance={getBalance} getUserDocs={getUserDocs} />
			</div>
		</div>
	);
};
