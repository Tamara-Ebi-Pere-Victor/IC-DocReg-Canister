import React, { useEffect, useCallback, useState } from 'react';
import { Container, Nav } from 'react-bootstrap';
import './App.css';
import Wallet from './components/Wallet';
import coverImg from './assets/img/registry.jpeg';
import { login, logout as destroy } from './utils/auth';
import { balance as principalBalance, getDfxAddress } from './utils/ledger';
import Cover from './components/utils/Cover';
import { Notification } from './components/utils/Notifications';
import DocReg from './components/docreg/DocReg';
import { Footer } from './components/docreg/Footer';

const App = function AppWrapper() {
	const isAuthenticated = window.auth.isAuthenticated;
	const principal = window.auth.principalText;

	const [balance, setBalance] = useState('0');
	const [address, setAddress] = useState('0');

	const getBalance = useCallback(async () => {
		if (isAuthenticated) {
			setBalance(await principalBalance());
		}
	}, [isAuthenticated]);

	const getAddress = useCallback(async () => {
		if (isAuthenticated) {
			setAddress(await getDfxAddress());
		}
	}, [isAuthenticated]);

	useEffect(() => {
		getBalance();
		getAddress();
	}, [getBalance, getAddress()]);

	return (
		<>
			<Notification />
			{isAuthenticated ? (
				<Container fluid="md">
					<Nav className="justify-content-between pt-5 pb-5">
						<Nav.Item>
							<h1>ICP DOCUMENT REGISTRY</h1>
						</Nav.Item>
						<Nav.Item>
							<Wallet
								principal={principal}
								dfxAddress={address}
								balance={balance}
								symbol={'ICP'}
								isAuthenticated={isAuthenticated}
								destroy={destroy}
							/>
						</Nav.Item>
					</Nav>
					<main>
						<DocReg getBalance={getBalance} />
						<Footer />
					</main>
				</Container>
			) : (
				<Cover name="Document Registry" login={login} coverImg={coverImg} />
			)}
		</>
	);
};

export default App;
