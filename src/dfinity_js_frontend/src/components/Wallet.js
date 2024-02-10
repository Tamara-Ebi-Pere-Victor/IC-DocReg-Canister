import React from 'react';
import { Dropdown, Stack } from 'react-bootstrap';
import { truncateAddress } from '../utils/conversions';
import { useState } from 'react';

const Wallet = ({ principal, dfxAddress, balance, symbol, isAuthenticated, destroy }) => {
	const [isCopied, setIsCopied] = useState(false);

	async function copyTextToClipboard(text) {
		if ('clipboard' in navigator) {
			return await navigator.clipboard.writeText(text);
		} else {
			return document.execCommand('copy', true, text);
		}
	}

	const handleCopyClick = (text) => {
		// Asynchronously call copyTextToClipboard
		copyTextToClipboard(text)
			.then(() => {
				// If successful, update the isCopied state value
				setIsCopied(true);
				setTimeout(() => {
					setIsCopied(false);
				}, 1000);
			})
			.catch((err) => {
				console.log(err);
			});
	};

	if (isAuthenticated) {
		return (
			<>
				<Dropdown>
					<Dropdown.Toggle
						variant="light"
						align="end"
						id="dropdown-basic"
						className="d-flex align-items-center border rounded-pill py-1"
					>
						{isCopied ? (
							'Copied...'
						) : (
							<>
								{balance} <span className="ms-1"> {symbol}</span>
							</>
						)}
					</Dropdown.Toggle>

					<Dropdown.Menu className="shadow-lg border-0">
						<Dropdown.Item>
							<Stack direction="horizontal" gap={2}>
								<i className="bi bi-person-circle fs-4" />
								Principal:
								<span className="font-monospace">{truncateAddress(principal)}</span>
							</Stack>
						</Dropdown.Item>

						<Dropdown.Item>
							<Stack
								direction="horizontal"
								gap={2}
								onClick={() => handleCopyClick(dfxAddress)}
							>
								<i className="bi bi-wallet2 fs-4" />
								Address:
								<span className="font-monospace">
									{truncateAddress(dfxAddress)}
								</span>
							</Stack>
						</Dropdown.Item>

						<Dropdown.Divider />

						<Dropdown.Item
							as="button"
							className="d-flex align-items-center"
							onClick={() => {
								destroy();
							}}
						>
							<i className="bi bi-box-arrow-right me-2 fs-4" />
							Logout
						</Dropdown.Item>
					</Dropdown.Menu>
				</Dropdown>
			</>
		);
	}

	return null;
};

export default Wallet;
