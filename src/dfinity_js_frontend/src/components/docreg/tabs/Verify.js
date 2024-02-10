import React from 'react';
import { Upload } from '../Upload';
export const Verify = ({ getBalance, getUserDocs }) => {
	return (
		<div className="my-5">
			<h5 className="fw-bold">Verify a Document</h5>
			<p>
				Blockchain users can (verify) documents by checking whether they exist in the
				"Document Registry" canister on the ICP blockchain decentralized network.
			</p>
			<Upload id="documentToVerify" getBalance={getBalance} getUserDocs={getUserDocs} />
		</div>
	);
};
