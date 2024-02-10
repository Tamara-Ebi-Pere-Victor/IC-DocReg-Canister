import React, { useState } from 'react';
import { toast } from 'react-toastify';
import { Form, Button, Spinner } from 'react-bootstrap';
import { sha3_256 } from 'js-sha3';
import * as registry from '../../utils/docreg';

export const Upload = ({ id, getBalance, getUserDocs }) => {
	const [hash, setHash] = useState('');

	const [name, setName] = useState('');

	const [loading, setLoading] = useState(false);

	function handleOnChange(file) {
		setName(file.name);
		var reader = new FileReader();
		reader.onload = function () {
			let documentHash = sha3_256(reader.result);
			setHash(documentHash);
		};
		reader.readAsBinaryString(file);
	}

	async function update() {
		getBalance();
		getUserDocs();
	}

	const addDocument = async (doc) => {
		setLoading(true);
		registry
			.addDocument(doc)
			.then(() => {
				toast.success(`Document ${hash.toString().slice(0, 10)} added successfully.`);
				update();
			})
			.catch((error) => {
				console.log({ error });
				toast.error('Failed to add Document to registry.');
			})
			.finally(() => {
				setLoading(false);
			});
	};

	const verifyDocument = async (doc) => {
		setLoading(true);
		registry
			.verifyDocument(doc)
			.then(() => {
				toast.success(`Document ${hash.toString().slice(0, 10)} is valid.`);
				getBalance();
			})
			.catch((error) => {
				console.log({ error });
				toast.error(`Document ${hash.toString().slice(0, 10)} is not valid.`);
			})
			.finally(() => {
				setLoading(false);
			});
	};

	function onSubmit(e) {
		e.preventDefault();
		if (!hash) {
			return;
		} else if (id === 'documentToVerify') {
			verifyDocument({ hash });
		} else if (id === 'documentForUpload') {
			addDocument({ name, hash });
		} else {
			console.log('invalid ID');
		}
	}

	return (
		<Form onSubmit={onSubmit} className="mt-4">
			<Form.Group className="my-2">
				<Form.Control
					id={id}
					type="file"
					onChange={(e) => handleOnChange(e.target.files[0])}
				/>
			</Form.Group>
			<Button type="submit" variant="success" id={`${id}Button`}>
				{loading ? (
					<>
						<span> {id === 'documentForUpload' ? 'Uploading' : 'Verifying'} </span>
						<Spinner
							animation="border"
							as="span"
							size="sm"
							role="status"
							aria-hidden="true"
							className="opacity-25"
						/>
					</>
				) : id === 'documentForUpload' ? (
					'Upload Document'
				) : (
					'Check Document'
				)}
			</Button>
		</Form>
	);
};
