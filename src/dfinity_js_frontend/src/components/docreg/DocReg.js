import { Tab, Tabs, TabList, TabPanel } from 'react-tabs';
import 'react-tabs/style/react-tabs.css';
import { Home } from './tabs/Home';
import { Submit } from './tabs/Submit';
import { Verify } from './tabs/Verify';
import { YourDocuments } from './tabs/YourDocuments';
import React, { useCallback, useEffect, useState } from 'react';
import * as docreg from '../../utils/docreg';
const DocReg = ({ getBalance }) => {
	const [totalDocs, setTotalDocs] = useState(null);
	const [userDocs, setUserDocs] = useState(null);
	const [loading, setLoading] = useState(false);

	const getTotalDocs = useCallback(async () => {
		try {
			setLoading(true);
			setTotalDocs(await docreg.getTotalDocs());
		} catch (error) {
			console.log({ error });
		} finally {
			setLoading(false);
		}
	}, []);

	const getUserDocs = useCallback(async () => {
		try {
			setLoading(true);
			setUserDocs(await docreg.getUserDocs());
		} catch (error) {
			console.log({ error });
		} finally {
			setLoading(false);
		}
	}, []);

	useEffect(() => {
		if (!totalDocs && !userDocs) {
			getTotalDocs();
			getUserDocs();
		}
	}, [userDocs, totalDocs, getTotalDocs, getUserDocs]);

	return (
		<Tabs style={{ minHeight: '400px' }}>
			<TabList id="menu">
				<Tab>Home</Tab>
				<Tab>Submit Document</Tab>
				<Tab>Verify Document</Tab>
				<Tab>Your Documents</Tab>
			</TabList>
			<TabPanel>
				<Home noOfDocument={totalDocs ? totalDocs : 0} />
			</TabPanel>
			<TabPanel>
				<Submit getBalance={getBalance} getUserDocs={getUserDocs} />
			</TabPanel>
			<TabPanel>
				<Verify getBalance={getBalance} getUserDocs={getUserDocs} />
			</TabPanel>
			<TabPanel>
				<YourDocuments getBalance={getBalance} userDocs={userDocs ? userDocs : []} />
			</TabPanel>
		</Tabs>
	);
};

export default DocReg;
