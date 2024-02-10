import React, { useState } from 'react';
import { Button, Spinner } from 'react-bootstrap';
import { toast } from 'react-toastify';
import { convertTime } from '../../../utils/conversions';
import * as registry from '../../../utils/docreg';

export const YourDocuments = ({ getBalance, userDocs }) => {
	const [loading, setLoading] = useState(false);
	const [activeDoc, setActiveDoc] = useState('');

	async function update() {
		getBalance();
	}

	const deleteDocument = (doc) => {
		setActiveDoc(doc.name);
		setLoading(true);

		registry
			.deleteDocument(doc.id)
			.then(() => {
				toast.success(`${doc.name} deleted successfully`);
				setTimeout(() => {
					update();
				}, 3000);
			})
			.catch((error) => {
				console.log({ error });
				toast.error(`Failed to delete ${doc.name}`);
			})
			.finally(() => {
				setLoading(false);
			});
	};

	return (
		<div className="my-5">
			<h5 className="fw-bold">Your Documents</h5>
			<p>Overview of all documents you have uploaded to the contract.</p>

			<div className="bg-gray-900 rounded-sm">
				<table className="w-full text-sm">
					<thead>
						<tr>
							<td className="px-4 py-3">Name</td>
							<td className="px-4 py-3">Date Added</td>
							<td className="text-right px-4 py-3">Action</td>
						</tr>
					</thead>
					<tbody className="font-mono">
						{userDocs.map((document) => (
							<tr key={document.id}>
								<td className="border-t border-gray-800 px-4 py-3">
									<span className="flex items-center space-x-1">
										{document.name}
									</span>
								</td>
								<td className="relative w-1/4 border-t border-gray-800">
									<span className="absolute inset-0 truncate px-4 py-3">
										{convertTime(document.createdAt)}
									</span>
								</td>
								<td className="relative w-1/4 border-t border-gray-800 px-4 py-3 text-right">
									<Button
										variant="outline-danger"
										onClick={() => deleteDocument(document)}
										className="btn"
									>
										{loading ? (
											activeDoc === document.name ? (
												<Spinner
													animation="border"
													as="span"
													size="sm"
													role="status"
													aria-hidden="true"
													className="opacity-25"
												/>
											) : (
												<i className="bi bi-trash"></i>
											)
										) : (
											<i className="bi bi-trash"></i>
										)}
									</Button>
								</td>
							</tr>
						))}
					</tbody>
				</table>
			</div>
		</div>
	);
};
